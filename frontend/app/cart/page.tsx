// Shopping cart page — displays cart items with remove, subtotal, and proceed to checkout
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart, CartItem } from '@/stores/cartStore';
import { imageTransformations } from '@/lib/cloudinary';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, getTotal } = useCart();

  useEffect(() => { useCart.persist.rehydrate(); }, []);

  const total = getTotal();

  if (items.length === 0) {
    return (
      <ScrollFade>
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-8">
          <h1 className="text-4xl font-playfair font-bold mb-4 text-[#f0e6d2]">Your Cart is Empty</h1>
          <p className="text-white/60 mb-8">Discover our collection of exceptional timepieces.</p>
          <Link href="/watches"
            className="py-4 px-10 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition">
            Explore Timepieces
          </Link>
        </div>
      </ScrollFade>
    );
  }

  return (
    <ScrollFade>
      <div className="min-h-screen bg-black text-white pt-32 pb-20 px-6 lg:px-16">
        <h1 className="text-4xl font-playfair font-bold text-[#f0e6d2] mb-2">Shopping Cart</h1>
        <p className="text-white/50 mb-10">{items.length} {items.length === 1 ? 'item' : 'items'}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="popLayout">
              {items.map((item: CartItem) => (
                <motion.div
                  key={item.watchId}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                  className="flex gap-6 p-5 rounded-2xl border border-white/10 bg-white/[0.02]"
                >
                  {/* Watch image */}
                  <Link href={`/watches/${item.watchId}`} className="shrink-0">
                    <div className="w-28 h-28 rounded-xl overflow-hidden bg-white/5">
                      {item.image ? (
                        <Image
                          src={imageTransformations.thumbnail(item.image)}
                          alt={item.name}
                          width={112}
                          height={112}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                          No image
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-widest text-white/40 mb-1">{item.brandName}</p>
                    <Link href={`/watches/${item.watchId}`}>
                      <h3 className="font-semibold text-white truncate hover:text-[#f0e6d2] transition">
                        {item.description || item.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-white/40 mt-0.5">{item.name}</p>
                    <p className="text-lg font-bold text-[#bfa68a] mt-3">
                      ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.watchId)}
                    className="self-start p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition"
                    title="Remove from cart"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-32 rounded-2xl border border-white/10 bg-white/[0.02] p-8">
              <h2 className="text-lg font-semibold text-white mb-6">Order Summary</h2>

              <div className="flex justify-between text-white/60 mb-4">
                <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
                <span className="text-white">
                  ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-white/60 mb-6">
                <span>Shipping</span>
                <span className="text-white/40 text-sm italic">Complimentary</span>
              </div>

              <hr className="border-white/10 mb-6" />

              <div className="flex justify-between mb-8">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-[#bfa68a]">
                  ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push('/checkout')}
                className="w-full py-4 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition text-center"
              >
                Proceed to Checkout
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </ScrollFade>
  );
}
