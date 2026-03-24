// Stripe CardElement payment form — renders inside StripeProvider (Elements context)
'use client';

import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';

interface CheckoutFormProps {
  clientSecret: string;
  totalAmount: number;
  onSuccess: () => void;
}

const cardStyle = {
  style: {
    base: {
      color: '#F9F6F2',
      fontFamily: '"Inter", sans-serif',
      fontSize: '16px',
      '::placeholder': { color: 'rgba(249, 246, 242, 0.4)' },
    },
    invalid: { color: '#ef4444' },
  },
};

export default function CheckoutForm({ clientSecret, totalAmount, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      setProcessing(false);
      return;
    }

    const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.');
      setProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-6">
        <label className="block text-sm text-white/60 mb-3">Card Details</label>
        <div className="border border-[#bfa68a]/30 bg-white/5 rounded-xl p-5">
          <CardElement options={cardStyle} />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <motion.button
        type="submit"
        disabled={!stripe || processing}
        whileTap={{ scale: 0.97 }}
        className="w-full py-4 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </span>
        ) : (
          `Pay $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        )}
      </motion.button>

      <p className="text-xs text-white/30 text-center mt-4">
        Test mode — no real charges. Use card 4242 4242 4242 4242
      </p>
    </motion.form>
  );
}
