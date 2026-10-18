import mongoose from "mongoose";
import transactionModel from "../models/transaction.model.js";
import ledgerModel from "../models/ledger.model.js";
import accountModel from "../models/account.model.js";

class TransferError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const assertSameRequest = (transaction, fromAccount, toAccount, amount) => {
  if (
    String(transaction.fromAccount) !== String(fromAccount) ||
    String(transaction.toAccount) !== String(toAccount) ||
    transaction.amount !== amount
  ) {
    throw new TransferError(
      "This idempotency key was already used for a different transfer.",
      409,
    );
  }

  if (transaction.status !== "COMPLETED") {
    throw new TransferError("This transfer cannot be retried.", 409);
  }

  return transaction;
};

const executeTransfer = async ({
  fromAccountId,
  toAccountId,
  userId,
  amount,
  idempotencyKey,
}) => {
  const existing = await transactionModel.findOne({ idempotencyKey });
  if (existing) {
    const ownedSource = await accountModel.exists({
      _id: existing.fromAccount,
      user: userId,
    });
    if (!ownedSource) {
      throw new TransferError("Transfer not found.", 404);
    }
    return assertSameRequest(existing, fromAccountId, toAccountId, amount);
  }

  const session = await mongoose.startSession();
  let completedTransaction;

  try {
    await session.withTransaction(async () => {
      const previousAttempt = await transactionModel
        .findOne({ idempotencyKey })
        .session(session);
      if (previousAttempt) {
        const ownedSource = await accountModel
          .exists({
            _id: previousAttempt.fromAccount,
            user: userId,
          })
          .session(session);
        if (!ownedSource) {
          throw new TransferError("Transfer not found.", 404);
        }
        completedTransaction = assertSameRequest(
          previousAttempt,
          fromAccountId,
          toAccountId,
          amount,
        );
        return;
      }

      const fromUserAccount = await accountModel
        .findOne({
          _id: fromAccountId,
          user: userId,
        })
        .session(session);
      const toUserAccount = await accountModel
        .findById(toAccountId)
        .session(session);

      if (!fromUserAccount || !toUserAccount) {
        throw new TransferError("Invalid source or destination account.", 404);
      }
      if (String(fromUserAccount._id) === String(toUserAccount._id)) {
        throw new TransferError("Source and destination accounts must differ.");
      }
      if (
        fromUserAccount.status !== "ACTIVE" ||
        toUserAccount.status !== "ACTIVE"
      ) {
        throw new TransferError("Both accounts must be active.");
      }

      const accountLock = await accountModel.updateOne(
        {
          _id: fromUserAccount._id,
          user: userId,
          status: "ACTIVE",
        },
        { $inc: { ledgerVersion: 1 } },
        { session },
      );
      if (accountLock.modifiedCount !== 1) {
        throw new TransferError("Source account is no longer active.", 409);
      }

      const balance = await fromUserAccount.getBalance(session);
      if (balance < amount) {
        throw new TransferError(
          `Insufficient balance. Current balance is ${balance}.`,
          409,
        );
      }

      const [transaction] = await transactionModel.create(
        [
          {
            fromAccount: fromUserAccount._id,
            toAccount: toUserAccount._id,
            amount,
            idempotencyKey,
            status: "PENDING",
          },
        ],
        { session },
      );

      await ledgerModel.create(
        [
          {
            account: fromUserAccount._id,
            amount,
            transaction: transaction._id,
            type: "DEBIT",
          },
          {
            account: toUserAccount._id,
            amount,
            transaction: transaction._id,
            type: "CREDIT",
          },
        ],
        { session },
      );

      transaction.status = "COMPLETED";
      completedTransaction = await transaction.save({ session });
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await transactionModel.findOne({ idempotencyKey });
      if (duplicate) {
        return assertSameRequest(
          duplicate,
          fromAccountId,
          toAccountId,
          amount,
        );
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return completedTransaction;
};

const parseTransfer = (body) => {
  const fromAccountId = String(body?.fromAccount || "");
  const toAccountId = String(body?.toAccount || "");
  const rawAmount = Number(body?.amount);
  const amountPaise = Math.round(rawAmount * 100);
  const idempotencyKey = String(body?.idempotencyKey || "").trim();

  if (
    !mongoose.isValidObjectId(fromAccountId) ||
    !mongoose.isValidObjectId(toAccountId)
  ) {
    throw new TransferError("Valid fromAccount and toAccount IDs are required.");
  }
  if (
    !Number.isFinite(rawAmount) ||
    !Number.isSafeInteger(amountPaise) ||
    amountPaise < 1 ||
    Math.abs(rawAmount * 100 - amountPaise) > 1e-7
  ) {
    throw new TransferError(
      "Amount must be a positive value with up to 2 decimals.",
    );
  }
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    throw new TransferError("A valid idempotencyKey is required.");
  }

  return {
    fromAccountId,
    toAccountId,
    amount: amountPaise / 100,
    idempotencyKey,
  };
};

const sendTransfer = async (req, res, fromAccountId) => {
  try {
    const parsed = parseTransfer({
      ...req.body,
      fromAccount: fromAccountId || req.body?.fromAccount,
    });
    const transaction = await executeTransfer({
      ...parsed,
      userId: req.user._id,
    });

    return res.status(201).json({
      message: "Transaction completed successfully.",
      transaction,
    });
  } catch (error) {
    if (error instanceof TransferError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Transaction processing failed:", error);
    return res.status(500).json({
      message: "Transaction could not be completed.",
    });
  }
};

export const createTransaction = async (req, res) => {
  return sendTransfer(req, res);
};

export const createInitialFundsTransaction = async (req, res) => {
  try {
    const systemAccount = await accountModel.findOne({
      user: req.user._id,
      status: "ACTIVE",
    });
    if (!systemAccount) {
      return res.status(404).json({
        message: "Active system user account not found.",
      });
    }

    return sendTransfer(req, res, systemAccount._id);
  } catch (error) {
    console.error("Initial funds transaction failed:", error);
    return res.status(500).json({
      message: "Initial funds transaction could not be completed.",
    });
  }
};
