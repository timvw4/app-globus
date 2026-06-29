'use client';

import { motion } from 'framer-motion';

interface PageContentProps {
  children: React.ReactNode;
}

/** Animation d'entrée douce pour le contenu des pages */
export function PageContent({ children }: PageContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
