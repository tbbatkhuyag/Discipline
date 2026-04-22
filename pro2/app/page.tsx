'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function Home() {
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 200,
      },
    },
  };

  const zoomVariants = {
    initial: { scale: 1 },
    zoomedIn: { scale: 1.5 },
  };

  const cardVariants = {
    rest: {
      scale: 1,
      opacity: 1,
    },
    hover: {
      scale: 1.1,
      opacity: 0.9,
      transition: {
        type: 'spring',
        damping: 10,
        stiffness: 300,
      },
    },
    selected: {
      scale: 1.3,
      opacity: 1,
      transition: {
        type: 'spring',
        damping: 8,
        stiffness: 200,
      },
    },
  };

  const cards = [
    { id: 1, title: 'Design', color: 'from-blue-400 to-blue-600' },
    { id: 2, title: 'Development', color: 'from-purple-400 to-purple-600' },
    { id: 3, title: 'Animation', color: 'from-pink-400 to-pink-600' },
    { id: 4, title: 'Innovation', color: 'from-green-400 to-green-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center p-8">
      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: 'spring', damping: 12 }}
      >
        <h1 className="text-5xl font-bold text-white mb-4">
          Zoom Transition Demo
        </h1>
        <p className="text-gray-400 text-lg">
          Interactive animations with Framer Motion
        </p>
      </motion.div>

      {/* Section 1: Simple Zoom Toggle */}
      <motion.div className="mb-20 w-full max-w-2xl">
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Simple Zoom Toggle
          </h2>
          <div className="flex flex-col items-center gap-8">
            <motion.div
              className="w-40 h-40 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl cursor-pointer flex items-center justify-center text-white font-bold text-2xl"
              variants={zoomVariants}
              initial="initial"
              animate={isZoomedIn ? 'zoomedIn' : 'initial'}
              transition={{
                type: 'spring',
                damping: 10,
                stiffness: 300,
              }}
              onClick={() => setIsZoomedIn(!isZoomedIn)}
            >
              Click me!
            </motion.div>
            <p className="text-gray-300">
              {isZoomedIn ? 'Zoomed In 🔍' : 'Click to zoom'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Section 2: Card Grid with Zoom */}
      <motion.div className="w-full max-w-4xl">
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
          <h2 className="text-2xl font-semibold text-white mb-8">
            Interactive Cards (Hover & Click)
          </h2>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {cards.map((card) => (
              <motion.div
                key={card.id}
                className={`h-48 rounded-xl cursor-pointer bg-gradient-to-br ${card.color} p-6 flex flex-col justify-between`}
                variants={itemVariants}
                whileHover="hover"
                animate={
                  selectedCard === card.id
                    ? 'selected'
                    : selectedCard === null
                      ? 'rest'
                      : 'rest'
                }
                initial="rest"
                onClick={() =>
                  setSelectedCard(selectedCard === card.id ? null : card.id)
                }
              >
                <div>
                  <motion.h3
                    className="text-2xl font-bold text-white"
                    animate={{
                      scale:
                        selectedCard === card.id
                          ? 1.2
                          : 1,
                    }}
                  >
                    {card.title}
                  </motion.h3>
                </div>
                <motion.div
                  className="text-white font-semibold"
                  animate={{
                    opacity:
                      selectedCard === card.id ? 1 : 0.7,
                  }}
                >
                  {selectedCard === card.id
                    ? 'Selected ✨'
                    : 'Click to select'}
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
          {selectedCard !== null && (
            <motion.div
              className="mt-8 p-4 bg-gray-700 rounded-lg text-white text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              Card {selectedCard} is selected! Click again to deselect.
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Section 3: Morphing Zoom Animation */}
      <motion.div className="mt-20 w-full max-w-2xl">
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
          <h2 className="text-2xl font-semibold text-white mb-8">
            Morphing Zoom Pattern
          </h2>
          <div className="flex justify-center items-center gap-8 h-40">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-lg"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.1,
                  repeat: Infinity,
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        className="mt-16 text-center text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p>
          Built with Next.js 16 + Framer Motion + Tailwind CSS
        </p>
      </motion.div>
    </div>
  );
}
