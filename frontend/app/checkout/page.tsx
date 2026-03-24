// Two-phase checkout: shipping form -> Stripe payment
// Supports both guest and authenticated users
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCart, CartItem } from '@/stores/cartStore';
import { useAuth } from '@/contexts/AuthContext';
import { createOrder, getCurrentUser } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { DYNAMIC_ROUTES } from '@/app/constants/routes';
import ScrollFade from '@/app/scrollMotion/ScrollFade';
import StripeProvider from '@/providers/StripeProvider';
import CheckoutForm from './CheckoutForm';

interface ShippingForm {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { items, getTotal, clearCart } = useCart();

  const [phase, setPhase] = useState<'shipping' | 'payment'>('shipping');
  const [orderId, setOrderId] = useState<number | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [shipping, setShipping] = useState<ShippingForm>({
    firstName: '', lastName: '', email: '',
    address: '', city: '', state: '', country: '',
  });

  useEffect(() => { useCart.persist.rehydrate(); }, []);

  // Pre-fill shipping from user profile
  useEffect(() => {
    if (!isAuthenticated) return;
    getCurrentUser().then(u => {
      if (u) {
        setShipping(prev => ({
          firstName: u.firstName || prev.firstName,
          lastName: u.lastName || prev.lastName,
          email: u.email || prev.email,
          address: u.address || prev.address,
          city: u.city || prev.city,
          state: u.state || prev.state,
          country: u.country || prev.country,
        }));
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  // Redirect to cart if empty
  useEffect(() => {
    // Delay check to allow rehydration
    const timer = setTimeout(() => {
      if (items.length === 0 && phase === 'shipping') router.replace('/cart');
    }, 500);
    return () => clearTimeout(timer);
  }, [items.length, phase, router]);

  const handlePlaceOrder = async () => {
    // Validate required fields
    if (!shipping.firstName || !shipping.lastName || !shipping.address ||
        !shipping.city || !shipping.country) {
      setError('Please fill in all required shipping fields.');
      return;
    }
    if (!isAuthenticated && !shipping.email) {
      setError('Email is required for guest checkout.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await createOrder({
        items: items.map(i => ({ watchId: i.watchId, quantity: 1 })),
        shippingFirstName: shipping.firstName,
        shippingLastName: shipping.lastName,
        shippingEmail: shipping.email,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
        shippingState: shipping.state,
        shippingCountry: shipping.country,
        guestEmail: !isAuthenticated ? shipping.email : undefined,
      });

      setOrderId(response.orderId);
      setClientSecret(response.clientSecret);
      setPhase('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    clearCart();
    if (orderId) router.push(DYNAMIC_ROUTES.ORDER_CONFIRMATION(orderId));
  };

  const total = getTotal();

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition";

  return (
    <ScrollFade>
      <div className="min-h-screen bg-black text-white pt-32 pb-20 px-6 lg:px-16">
        <h1 className="text-4xl font-playfair font-bold text-[#f0e6d2] mb-2">Checkout</h1>
        {!isAuthenticated && phase === 'shipping' && (
          <p className="text-white/50 mb-2">
            Checking out as guest.{' '}
            <Link href={`/login?redirect=/checkout`} className="text-[#bfa68a] hover:underline">
              Sign in
            </Link>{' '}
            for a faster experience.
          </p>
        )}
        {isAuthenticated && (
          <p className="text-white/50 mb-2">Signed in as {user?.email}</p>
        )}

        {/* Steps indicator */}
        <div className="flex items-center gap-3 mb-10 text-sm">
          <span className={phase === 'shipping' ? 'text-[#bfa68a] font-semibold' : 'text-white/40'}>
            1. Shipping
          </span>
          <span className="text-white/20">—</span>
          <span className={phase === 'payment' ? 'text-[#bfa68a] font-semibold' : 'text-white/40'}>
            2. Payment
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left column — form or payment */}
          <div className="lg:col-span-2">
            {phase === 'shipping' ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-xl font-semibold mb-6">Shipping Information</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">First Name *</label>
                    <input type="text" value={shipping.firstName}
                      onChange={e => setShipping(s => ({ ...s, firstName: e.target.value }))}
                      className={inputClass} placeholder="First name" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Last Name *</label>
                    <input type="text" value={shipping.lastName}
                      onChange={e => setShipping(s => ({ ...s, lastName: e.target.value }))}
                      className={inputClass} placeholder="Last name" />
                  </div>
                </div>

                {!isAuthenticated && (
                  <div className="mb-4">
                    <label className="block text-sm text-white/60 mb-1.5">Email *</label>
                    <input type="email" value={shipping.email}
                      onChange={e => setShipping(s => ({ ...s, email: e.target.value }))}
                      className={inputClass} placeholder="your@email.com" />
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm text-white/60 mb-1.5">Address *</label>
                  <input type="text" value={shipping.address}
                    onChange={e => setShipping(s => ({ ...s, address: e.target.value }))}
                    className={inputClass} placeholder="Street address" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">City *</label>
                    <input type="text" value={shipping.city}
                      onChange={e => setShipping(s => ({ ...s, city: e.target.value }))}
                      className={inputClass} placeholder="City" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">State</label>
                    <input type="text" value={shipping.state}
                      onChange={e => setShipping(s => ({ ...s, state: e.target.value }))}
                      className={inputClass} placeholder="State / Province" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Country *</label>
                    <input type="text" value={shipping.country}
                      onChange={e => setShipping(s => ({ ...s, country: e.target.value }))}
                      className={inputClass} placeholder="Country" />
                  </div>
                </div>

                {error && (
                  <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handlePlaceOrder}
                  disabled={submitting}
                  className="py-4 px-10 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition disabled:opacity-50"
                >
                  {submitting ? 'Creating Order...' : 'Continue to Payment'}
                </motion.button>
              </motion.div>
            ) : (
              clientSecret && (
                <StripeProvider clientSecret={clientSecret}>
                  <h2 className="text-xl font-semibold mb-6">Payment</h2>
                  <CheckoutForm
                    clientSecret={clientSecret}
                    totalAmount={serverTotal ?? total}
                    onSuccess={handlePaymentSuccess}
                  />
                </StripeProvider>
              )
            )}
          </div>

          {/* Right column — order summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-32 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

              <div className="space-y-4 mb-6">
                {items.map((item: CartItem) => (
                  <div key={item.watchId} className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0">
                      {item.image && (
                        <Image
                          src={imageTransformations.thumbnail(item.image)}
                          alt={item.name}
                          width={56} height={56}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.description || item.name}</p>
                      <p className="text-xs text-white/40">{item.brandName}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#bfa68a] shrink-0">
                      ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>

              <hr className="border-white/10 mb-4" />

              <div className="flex justify-between">
                <span className="text-white/60">Total</span>
                <span className="text-xl font-bold text-[#bfa68a]">
                  ${(serverTotal ?? total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollFade>
  );
}
