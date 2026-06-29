'use client';

import { useTranslations } from 'next-intl';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Bouton qui déclenche l'impression de la fiche de livraison.
 * On utilise l'impression du navigateur (window.print) ; ce sont les styles
 * d'impression (globals.css) qui décident de ce qui apparaît sur la feuille.
 */
export function PrintButton() {
  const t = useTranslations('order');

  return (
    <Button
      type="button"
      variant="outline"
      className="no-print"
      onClick={() => window.print()}
    >
      <Printer className="h-4 w-4 mr-2" />
      {t('actions.print')}
    </Button>
  );
}
