import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const OrderSuccess = () => {
  const location = useLocation();
  const duplicateRefund = location.state?.duplicatePaymentRefund;
  const containerStyle = {
    maxWidth: '600px',
    margin: '50px auto',
    padding: '50px 30px',
    background: '#10221b',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    textAlign: 'center'
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '20px', color: '#10b981' }}>Payment Successful!</h2>
      <p style={{ color: '#a9b9ae', fontSize: '1.2rem', marginBottom: '40px' }}>
        Thank you for your order. We have securely received your payment and will process your shipment shortly.
      </p>
      {duplicateRefund && (
        <p
          role="status"
          style={{
            color: duplicateRefund.status === 'refunded' ? '#48c9a1' : '#fca5a5',
            marginBottom: '24px',
          }}
        >
          {duplicateRefund.status === 'refunded'
            ? 'A duplicate charge was detected and its refund has been processed by our payment provider.'
            : 'A duplicate charge was detected. Its refund is being reviewed; contact support if it does not appear in your account.'}
        </p>
      )}
      <Link to="/shop" className="btn">Continue Shopping</Link>
    </div>
  );
};

export default OrderSuccess;
