// Order confirmation page — polls until webhook confirms the order
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetchOrder } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

// Animated checkmark SVG
function AnimatedCheckmark() {
  return (
    <motion.svg
      width="80" height="80" viewBox="0 0 80 80" fill="none"
      initial={{ scale: 0 }} animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
    >
      <circle cx="40" cy="40" r="38" stroke="#bfa68a" strokeWidth="3" fill="none"
        strokeDasharray="240" strokeDashoffset="0">
        <animate attributeName="stroke-dashoffset" from="240" to="0" dur="0.6s" fill="freeze" />
      </circle>
      <motion.path
        d="M24 42L34 52L56 30" stroke="#bfa68a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      />
    </motion.svg>
  );
}

export default function ConfirmationPage() {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get('orderId');
  const orderId = orderIdParam ? parseInt(orderIdParam, 10) : NaN;

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: !isNaN(orderId),
    refetchInterval: (query) => {
      // Poll every 2s until confirmed, then stop
      const status = query.state.data?.status;
      return status === 'Confirmed' ? false : 2000;
    },
  });

  if (isNaN(orderId)) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">Invalid order ID.</p>
      </div>
    );
  }

  if (isLoading || !order) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-[#bfa68a] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white/60">Loading order details...</p>
        </div>
      </div>
    );
  }

  const isConfirmed = order.status === 'Confirmed';

  return (
    <ScrollFade>
      <div className="min-h-screen bg-black text-white pt-32 pb-20 px-6 lg:px-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* Status icon */}
          <div className="flex justify-center mb-6">
            {isConfirmed ? (
              <AnimatedCheckmark />
            ) : (
              <div className="w-20 h-20 rounded-full border-2 border-[#bfa68a]/40 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-[#bfa68a] border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          <h1 className="text-3xl font-playfair font-bold text-[#f0e6d2] mb-2">
            {isConfirmed ? 'Order Confirmed' : 'Processing Payment...'}
          </h1>
          <p className="text-white/50 mb-2">Order #{order.id}</p>
          <p className="text-white/40 text-sm mb-10">
            {isConfirmed
              ? `Confirmed on ${new Date(order.confirmedAt!).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
              : 'Your payment is being verified. This usually takes a few seconds.'}
          </p>

          {/* Order items */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left mb-8">
            <h2 className="text-sm uppercase tracking-widest text-white/40 mb-4">Items</h2>
            <div className="space-y-4">
              {order.items.map(item => (
                <div key={item.watchId} className="flex gap-4 items-center">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0">
                    {item.watchImageUrl && (
                      <Image
                        src={imageTransformations.thumbnail(item.watchImageUrl)}
                        alt={item.watchName}
                        width={64} height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{item.watchDescription || item.watchName}</p>
                    <p className="text-xs text-white/40">{item.watchName}</p>
                  </div>
                  <p className="text-[#bfa68a] font-semibold shrink-0">
                    ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>

            <hr className="border-white/10 my-4" />

            <div className="flex justify-between items-center">
              <span className="text-white/60">Total</span>
              <span className="text-2xl font-bold text-[#bfa68a]">
                ${order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Shipping */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left mb-10">
            <h2 className="text-sm uppercase tracking-widest text-white/40 mb-3">Shipping To</h2>
            <p className="text-white">{order.shipping.firstName} {order.shipping.lastName}</p>
            <p className="text-white/60 text-sm">{order.shipping.address}</p>
            <p className="text-white/60 text-sm">
              {[order.shipping.city, order.shipping.state, order.shipping.country].filter(Boolean).join(', ')}
            </p>
          </div>

          <Link href="/watches"
            className="inline-block py-4 px-10 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition">
            Continue Shopping
          </Link>
        </div>
      </div>
    </ScrollFade>
  );
}
