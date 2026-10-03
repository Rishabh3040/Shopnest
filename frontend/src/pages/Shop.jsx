import React, { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";
import { apiUrl } from "../utils/api";
import "../styles/product.css";

const Shop = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(apiUrl("/api/products?page=1&limit=50"));

        if (!res.ok) {
          throw new Error(`Failed to fetch products: ${res.status}`);
        }

        const data = await res.json();

        const productsData = Array.isArray(data)
          ? data
          : data.data || data.products || [];

        for (let page = 2; page <= (data.pages || 1); page += 1) {
          const pageResponse = await fetch(
            apiUrl(`/api/products?page=${page}&limit=50`),
          );
          if (!pageResponse.ok) break;
          const pageData = await pageResponse.json();
          productsData.push(
            ...(Array.isArray(pageData)
              ? pageData
              : pageData.data || pageData.products || []),
          );
        }

        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Search products
  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="shop-container">
      <h2>All Products</h2>

      <input
        id="product-search"
        name="search"
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-bar"
      />

      {loading ? (
        <div>Loading...</div>
      ) : filteredProducts.length > 0 ? (
        <div className="product-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="no-products">
          <p>No products found.</p>
        </div>
      )}
    </div>
  );
};

export default Shop;
