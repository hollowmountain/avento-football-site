'use client';

import { QrCode } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';

/** QR-код ссылки на игру — показать в раздевалке или чате. */
export function QrDialog({ gameCode, title }: { gameCode: string; title: string }) {
  const t = useTranslations('game');
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const onOpenChange = async (open: boolean) => {
    if (open && !dataUrl) {
      const QRCode = (await import('qrcode')).default;
      const url = `${window.location.origin}/games/${gameCode}`;
      setDataUrl(await QRCode.toDataURL(url, { width: 512, margin: 1 }));
    }
  };

  return (
    <Dialog onOpenChange={(open) => void onOpenChange(open)}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" aria-label={t('qr')}>
          <QrCode className="size-4" /> {t('qr')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data:URL, next/image не нужен
          <img src={dataUrl} alt={t('qr')} className="w-full rounded-lg" />
        ) : null}
        <p className="text-muted-foreground text-center digits text-sm">{gameCode}</p>
      </DialogContent>
    </Dialog>
  );
}
