import jwt from "jsonwebtoken";
import config from "../config/config.js";
import userModel from "../models/user.model.js";
import tokenBlacklistModel from "../models/blackList.model.js";

function getToken(req) {
  const authorization = req.headers.authorization;
  const bearerToken =
    authorization && authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  return req.cookies?.token || bearerToken;
}

async function authenticate(req, res, next, requireSystemUser = false) {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized access, token is missing",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        message: "Unauthorized access, token is invalid",
      });
    }
    return next(error);
  }

  try {
    const blacklistedToken = await tokenBlacklistModel.findOne({
      token,
      expiresAt: { $gt: new Date() },
    });

    if (blacklistedToken) {
      return res.status(401).json({
        message: "Unauthorized access, token is invalid",
      });
    }

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized access, token is invalid",
      });
    }

    let userQuery = userModel.findById(userId).select("-password");
    if (requireSystemUser) {
      userQuery = userQuery.select("+systemUser");
    }
    const user = await userQuery;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized access, user not found",
      });
    }

    if (requireSystemUser && !user.systemUser) {
      return res.status(403).json({
        message: "Forbidden access, not a system user",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export const authMiddleware = (req, res, next) =>
  authenticate(req, res, next);

export const authSystemUserMiddleware = (req, res, next) =>
  authenticate(req, res, next, true);

export const protect = authMiddleware;
export const Protect = protect;
