'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  PINNED_PHONE_CODES,
  OTHER_PHONE_CODES,
  formatPhoneNumber,
  parsePhoneNumber,
} from '@/lib/phone-codes';

interface PhoneInputProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
}

export function PhoneInput({
  id = 'client-phone',
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
}: PhoneInputProps) {
  const t = useTranslations('order.phone');
  const parsed = parsePhoneNumber(value);
  const [countryCode, setCountryCode] = useState(parsed.code);
  const [localNumber, setLocalNumber] = useState(parsed.number);

  // Resynchroniser si la valeur externe change (ex. brouillon restauré)
  useEffect(() => {
    const next = parsePhoneNumber(value);
    setCountryCode(next.code);
    setLocalNumber(next.number);
  }, [value]);

  function emitChange(code: string, number: string) {
    onChange(formatPhoneNumber(code, number));
  }

  function handleCodeChange(code: string) {
    setCountryCode(code);
    emitChange(code, localNumber);
  }

  function handleNumberChange(number: string) {
    const cleaned = number.replace(/[^\d\s]/g, '');
    setLocalNumber(cleaned);
    emitChange(countryCode, cleaned);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Select value={countryCode} onValueChange={handleCodeChange}>
          <SelectTrigger
            className="w-[130px] shrink-0"
            aria-label={t('countryCode')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72 min-w-[240px]">
            <SelectGroup>
              <SelectLabel>{t('pinned')}</SelectLabel>
              {PINNED_PHONE_CODES.map((item) => (
                <SelectItem key={item.code} value={item.code}>
                  {item.code} {item.country}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{t('others')}</SelectLabel>
              {OTHER_PHONE_CODES.map((item) => (
                <SelectItem key={item.code} value={item.code}>
                  {item.code} {item.country}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Input
          id={id}
          type="tel"
          inputMode="tel"
          value={localNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder ?? t('placeholder')}
          className={cn('flex-1', error && 'border-destructive focus-visible:ring-destructive')}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
