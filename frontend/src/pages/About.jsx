import React from "react";
import { Link } from "react-router-dom";
import logo from "../images/logo.png";
import "../styles/about.css";

const values = [
  {
    number: "01",
    title: "Browse with clarity",
    description:
      "Product details, prices, and availability stay together so you can compare before you choose.",
  },
  {
    number: "02",
    title: "Keep it convenient",
    description:
      "Find everyday categories in one place, then keep your picks together in a simple cart.",
  },
  {
    number: "03",
    title: "Stay in control",
    description:
      "Account and order pages make it easier to follow what you have saved and purchased.",
  },
];

const About = () => (
  <main className="about-page">
    <section className="about-hero" aria-labelledby="about-title">
      <div className="about-copy">
        <p className="about-kicker">A little about us</p>
        <h1 id="about-title">ShopNest</h1>
        <p className="about-lede">
          Everyday shopping, made more straightforward.
        </p>
        <p className="about-description">
          ShopNest brings a range of useful finds together in one online store.
          Explore the collection, compare the details, and choose what works for
          your day.
        </p>
        <div className="about-actions">
          <Link to="/shop" className="btn">
            Explore the shop
          </Link>
          <Link to="/return" className="about-secondary-link">
            Return policy <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>

      <div className="about-mark">
        <img src={logo} alt="ShopNest shopping bag logo" />
        <p>Useful finds. One welcoming place.</p>
      </div>
    </section>

    <section className="about-values" aria-labelledby="about-values-title">
      <div className="about-values-heading">
        <p className="about-kicker">The ShopNest approach</p>
        <h2 id="about-values-title">
          A simpler way to find your next favourite.
        </h2>
      </div>
      <div className="about-values-list">
        {values.map((value) => (
          <article className="about-value" key={value.number}>
            <span className="about-value-number">{value.number}</span>
            <h3>{value.title}</h3>
            <p>{value.description}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="about-bottom" aria-label="Continue exploring">
      <p>Take a look around and see what fits your everyday.</p>
      <Link to="/shop" className="about-secondary-link">
        Browse products <span aria-hidden="true">↗</span>
      </Link>
    </section>
  </main>
);

export default About;
