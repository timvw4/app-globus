'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  createOrderFormSchemaWithContext,
  type OrderFormData,
} from '@globus/core/schemas';
import {
  generateTimeSlots,
  shouldOfferExtraInsurance,
  calculatePrice,
  parseBagNumber,
  formatBagNumber,
} from '@globus/core/business';
import { PICKUP_OTHER_VALUE } from '@globus/core/types';
import type { AppSettings, PickupLocation, PricingRule, DeliveryOptionConfig } from '@globus/core/types';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { PhoneInput } from '@/components/ui/phone-input';
import { Upload, Plus, Trash2 } from 'lucide-react';
import { translateValidationKey } from '@/lib/utils';

const ORDER_DRAFT_KEY = 'globus_order_draft';

// Valeurs par défaut d'un nouveau colis vide
const EMPTY_PACKAGE = {
  bag_number: '',
  description: '',
  weight: undefined,
  dimensions: '',
  fragile: false,
  perishable: false,
  declared_value_chf: undefined,
  extra_insurance: false,
  goods_photo_url: '',
};

/**
 * Trois cases « Longueur × largeur × hauteur » avec les séparateurs déjà
 * affichés. L'utilisateur ne saisit que les chiffres ; on reconstruit
 * une seule chaîne (ex: "30×20×15 cm") stockée dans le champ `dimensions`.
 */
function DimensionsFields({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  // On découpe la chaîne existante en 3 morceaux (longueur, largeur, hauteur)
  const parts = (value ?? '')
    .replace(/cm/i, '')
    .split(/[×x]/)
    .map((part) => part.trim());
  const length = parts[0] ?? '';
  const width = parts[1] ?? '';
  const height = parts[2] ?? '';

  function update(next: [string, string, string]) {
    const [l, w, h] = next;
    // Si tout est vide, on enregistre une chaîne vide (champ non rempli)
    if (!l && !w && !h) {
      onChange('');
    } else {
      onChange(`${l}×${w}×${h} cm`);
    }
  }

  const inputClass = 'flex-1 min-w-0 text-center';

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="L"
          value={length}
          onChange={(e) => update([e.target.value, width, height])}
          className={inputClass}
        />
        <span className="text-muted-foreground">×</span>
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="l"
          value={width}
          onChange={(e) => update([length, e.target.value, height])}
          className={inputClass}
        />
        <span className="text-muted-foreground">×</span>
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="h"
          value={height}
          onChange={(e) => update([length, width, e.target.value])}
          className={inputClass}
        />
        <span className="text-sm text-muted-foreground">cm</span>
      </div>
    </div>
  );
}

/** Renvoie le suffixe d'étage : 1 → "er", sinon → "ème" */
function floorSuffix(value: number): string {
  return value === 1 ? 'er' : 'ème';
}

/** Met un chiffre d'étage au bon format français : 1 → "1er", 2 → "2ème"... */
function formatFloor(value: number): string {
  return `${value}${floorSuffix(value)}`;
}

/**
 * Champ « Étage » : l'utilisateur saisit uniquement un chiffre, et le suffixe
 * (« er » / « ème ») est ajouté automatiquement. On stocke la valeur déjà
 * formatée (ex: "2ème") dans le champ `floor`.
 */
function FloorField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  // On récupère uniquement la partie chiffrée de la valeur enregistrée
  const match = (value ?? '').match(/\d+/);
  const numberPart = match ? match[0] : '';
  // Suffixe affiché à côté de la case (uniquement "er" ou "ème")
  const suffix = numberPart ? floorSuffix(Number.parseInt(numberPart, 10)) : '';

  function update(raw: string) {
    if (raw === '') {
      onChange('');
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      onChange('');
      return;
    }
    onChange(formatFloor(parsed));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          value={numberPart}
          onChange={(e) => update(e.target.value)}
          className="w-24"
        />
        {suffix && <span className="text-sm font-medium text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

const formSectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const },
  }),
};

interface OrderFormProps {
  locale: string;
  pickupLocations: PickupLocation[];
  settings: AppSettings;
  pricingRule: PricingRule | null;
  deliveryOptions: DeliveryOptionConfig[];
  // Premier numéro de sac/colis libre, calculé côté serveur
  nextBagNumber: string;
}

export function OrderForm({
  locale,
  pickupLocations,
  settings,
  pricingRule,
  deliveryOptions,
  nextBagNumber,
}: OrderFormProps) {
  const t = useTranslations();
  const router = useRouter();
  // Index du colis dont la photo est en cours d'envoi (null = aucun)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [timeSlots, setTimeSlots] = useState<{ value: string; label: string }[]>([]);

  const schema = createOrderFormSchemaWithContext({
    operatingHours: settings.operating_hours,
    cutoffs: settings.cutoffs,
    now: new Date(),
  });

  const form = useForm<OrderFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pickup_location_id: '',
      pickup_address_custom: '',
      delivery_address: '',
      access_type: 'acces_libre',
      access_detail: '',
      is_hotel: false,
      hotel_room_number: '',
      floor: '',
      client_name: '',
      client_phone: '',
      requested_date: '',
      requested_time_slot: '',
      leave_at_door: false,
      special_instructions: '',
      // On démarre toujours avec un colis vide, pré-rempli avec un numéro libre
      packages: [{ ...EMPTY_PACKAGE, bag_number: nextBagNumber }],
      price_chf: pricingRule?.base_price_chf ?? 25,
    },
    mode: 'onChange',
  });

  // Gestion de la liste dynamique de colis
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'packages',
  });

  const watchPickup = form.watch('pickup_location_id');
  const watchAccessType = form.watch('access_type');
  const watchIsHotel = form.watch('is_hotel');
  const watchDate = form.watch('requested_date');
  const watchPackages = form.watch('packages');

  const isOptionEnabled = (key: string) =>
    deliveryOptions.some((o) => o.key === key && o.enabled);

  // Restaurer le brouillon si existant
  useEffect(() => {
    const draft = sessionStorage.getItem(ORDER_DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        Object.entries(parsed).forEach(([key, value]) => {
          form.setValue(key as keyof OrderFormData, value as never);
        });
      } catch {
        // Ignorer
      }
    }
  }, [form]);

  // Mettre à jour les créneaux quand la date change
  useEffect(() => {
    if (watchDate) {
      const date = new Date(watchDate + 'T12:00:00');
      const slots = generateTimeSlots(date, settings.operating_hours);
      setTimeSlots(slots);
      if (form.getValues('requested_time_slot') && !slots.find((s) => s.value === form.getValues('requested_time_slot'))) {
        form.setValue('requested_time_slot', '');
      }
    } else {
      setTimeSlots([]);
    }
  }, [watchDate, settings.operating_hours, form]);

  // Recalculer le prix : un supplément s'applique si AU MOINS un colis
  // est fragile / périssable / assuré.
  useEffect(() => {
    if (!pricingRule) return;
    const list = watchPackages ?? [];
    const anyFragile = list.some((p) => p?.fragile);
    const anyPerishable = list.some((p) => p?.perishable);
    const anyInsurance = list.some((p) => p?.extra_insurance);
    const result = calculatePrice(
      {
        fragile: anyFragile,
        perishable: anyPerishable,
        extra_insurance: anyInsurance,
        declared_value_chf: null,
      },
      pricingRule,
    );
    form.setValue('price_chf', result.total);
  }, [watchPackages, pricingRule, form]);

  async function handlePhotoUpload(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingIndex(index);
    const supabase = createBrowserClient();
    const fileName = `${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from('goods-photos')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      setUploadingIndex(null);
      return;
    }

    const { data: urlData } = supabase.storage.from('goods-photos').getPublicUrl(data.path);
    form.setValue(`packages.${index}.goods_photo_url`, urlData.publicUrl);
    setUploadingIndex(null);
  }

  // Calcule le prochain numéro de sac/colis libre, en tenant compte à la fois
  // des commandes déjà en base et des colis déjà ajoutés dans ce formulaire.
  function computeNextBagNumber(): string {
    const dbHighest = (parseBagNumber(nextBagNumber) ?? 1) - 1;
    const inForm = (form.getValues('packages') ?? []).map(
      (p) => parseBagNumber(p?.bag_number) ?? 0,
    );
    const highestInForm = inForm.length ? Math.max(...inForm) : 0;
    return formatBagNumber(Math.max(dbHighest, highestInForm) + 1);
  }

  function onSubmit(data: OrderFormData) {
    sessionStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(data));
    router.push(`/${locale}/orders/new/review`);
  }

  // Erreur d'un champ simple de la commande
  function getError(field: keyof OrderFormData) {
    const err = form.formState.errors[field];
    if (!err || typeof err !== 'object' || !('message' in err) || !err.message) return undefined;
    return translateValidationKey(err.message as string, t);
  }

  // Erreur d'un champ d'un colis précis
  function getPackageError(index: number, field: keyof OrderFormData['packages'][number]) {
    const msg = form.formState.errors.packages?.[index]?.[field]?.message;
    if (!msg) return undefined;
    return translateValidationKey(msg as string, t);
  }

  // Erreur globale sur la liste de colis (ex: aucun colis)
  const packagesRootError =
    form.formState.errors.packages?.root?.message ??
    (typeof form.formState.errors.packages?.message === 'string'
      ? form.formState.errors.packages?.message
      : undefined);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Section obligatoire — Départ & destination */}
      <motion.div custom={0} initial="hidden" animate="visible" variants={formSectionVariants}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t('order.sections.pickup')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('order.fields.pickupLocation')} *</Label>
            <Select
              value={watchPickup}
              onValueChange={(v) => form.setValue('pickup_location_id', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('order.fields.pickupLocation')} />
              </SelectTrigger>
              <SelectContent>
                {pickupLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.label}
                  </SelectItem>
                ))}
                <SelectItem value={PICKUP_OTHER_VALUE}>{t('order.fields.pickupOther')}</SelectItem>
              </SelectContent>
            </Select>
            {getError('pickup_location_id') && (
              <p className="text-sm text-destructive">{getError('pickup_location_id')}</p>
            )}
          </div>

          {watchPickup === PICKUP_OTHER_VALUE && (
            <div className="space-y-2">
              <Controller
                name="pickup_address_custom"
                control={form.control}
                render={({ field }) => (
                  <AddressAutocomplete
                    label={t('order.fields.pickupCustom')}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Rue, numéro, ville..."
                    hint={t('order.address.hint')}
                    error={getError('pickup_address_custom')}
                    required
                  />
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>

      <motion.div custom={1} initial="hidden" animate="visible" variants={formSectionVariants}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t('order.sections.delivery')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Controller
            name="delivery_address"
            control={form.control}
            render={({ field }) => (
              <AddressAutocomplete
                label={t('order.fields.deliveryAddress')}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Rue, numéro, NPA, ville..."
                hint={t('order.address.hint')}
                error={getError('delivery_address')}
                required
              />
            )}
          />

          <div className="space-y-2">
            <Label>{t('order.fields.accessType')} *</Label>
            <Select
              value={watchAccessType}
              onValueChange={(v) =>
                form.setValue('access_type', v as OrderFormData['access_type'], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['code', 'interphone', 'acces_libre', 'autre'] as const).map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`order.accessTypes.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {watchAccessType !== 'acces_libre' && (
            <div className="space-y-2">
              <Label>{t('order.fields.accessDetail')} *</Label>
              <Input {...form.register('access_detail')} />
              {getError('access_detail') && (
                <p className="text-sm text-destructive">{getError('access_detail')}</p>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_hotel"
              checked={watchIsHotel}
              onCheckedChange={(c) => form.setValue('is_hotel', !!c, { shouldValidate: true })}
            />
            <Label htmlFor="is_hotel">{t('order.fields.isHotel')}</Label>
          </div>

          {watchIsHotel && (
            <div className="space-y-2">
              <Label>{t('order.fields.hotelRoom')} *</Label>
              <Input {...form.register('hotel_room_number')} />
              {getError('hotel_room_number') && (
                <p className="text-sm text-destructive">{getError('hotel_room_number')}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>

      {/* Date & créneau */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={formSectionVariants}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t('order.sections.scheduling')} *</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('order.fields.requestedDate')} *</Label>
            <Input type="date" {...form.register('requested_date')} min={new Date().toISOString().split('T')[0]} />
            {getError('requested_date') && (
              <p className="text-sm text-destructive">{getError('requested_date')}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('order.fields.requestedTimeSlot')} *</Label>
            <Select
              value={form.watch('requested_time_slot') || ''}
              onValueChange={(v) => form.setValue('requested_time_slot', v, { shouldValidate: true })}
              disabled={!watchDate || timeSlots.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={timeSlots.length === 0 ? '—' : undefined} />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getError('requested_time_slot') && (
              <p className="text-sm text-destructive">{getError('requested_time_slot')}</p>
            )}
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Section obligatoire — Caractéristiques du/des colis (multi-colis) */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={formSectionVariants}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t('order.sections.characteristics')} *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {fields.map((field, index) => {
            const declaredValue = watchPackages?.[index]?.declared_value_chf;
            const showInsuranceOffer = shouldOfferExtraInsurance(
              typeof declaredValue === 'number' ? declaredValue : null,
            );
            return (
              <div
                key={field.id}
                className="rounded-lg border border-border p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    {t('order.fields.packageTitle', { number: index + 1 })}
                  </h3>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t('order.actions.removePackage')}
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('order.fields.bagNumber')}</Label>
                  <Input
                    {...form.register(`packages.${index}.bag_number`)}
                    placeholder={t('order.fields.bagNumberPlaceholder')}
                    readOnly
                    tabIndex={-1}
                    aria-readonly="true"
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('order.fields.bagNumberAuto')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('order.fields.packageDescription')} *</Label>
                  <Input
                    {...form.register(`packages.${index}.description`)}
                    placeholder={t('order.fields.packageDescriptionPlaceholder')}
                  />
                  {getPackageError(index, 'description') && (
                    <p className="text-sm text-destructive">
                      {getPackageError(index, 'description')}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('order.fields.weight')} *</Label>
                    <Input
                      {...form.register(`packages.${index}.weight`)}
                      type="number"
                      step="0.1"
                    />
                    {getPackageError(index, 'weight') && (
                      <p className="text-sm text-destructive">
                        {getPackageError(index, 'weight')}
                      </p>
                    )}
                  </div>
                  <Controller
                    name={`packages.${index}.dimensions`}
                    control={form.control}
                    render={({ field }) => (
                      <DimensionsFields
                        label={t('order.fields.dimensions')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t('order.fields.declaredValue')}</Label>
                    <Input
                      {...form.register(`packages.${index}.declared_value_chf`)}
                      type="number"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  {isOptionEnabled('fragile') && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`fragile-${index}`}
                        checked={!!watchPackages?.[index]?.fragile}
                        onCheckedChange={(c) =>
                          form.setValue(`packages.${index}.fragile`, !!c)
                        }
                      />
                      <Label htmlFor={`fragile-${index}`}>{t('order.fields.fragile')}</Label>
                    </div>
                  )}
                  {isOptionEnabled('perishable') && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`perishable-${index}`}
                        checked={!!watchPackages?.[index]?.perishable}
                        onCheckedChange={(c) =>
                          form.setValue(`packages.${index}.perishable`, !!c)
                        }
                      />
                      <Label htmlFor={`perishable-${index}`}>
                        {t('order.fields.perishable')}
                      </Label>
                    </div>
                  )}
                  {showInsuranceOffer && isOptionEnabled('extra_insurance') && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`extra_insurance-${index}`}
                        checked={!!watchPackages?.[index]?.extra_insurance}
                        onCheckedChange={(c) =>
                          form.setValue(`packages.${index}.extra_insurance`, !!c, {
                            shouldValidate: true,
                          })
                        }
                      />
                      <Label htmlFor={`extra_insurance-${index}`}>
                        {t('order.fields.extraInsurance')}
                      </Label>
                    </div>
                  )}
                </div>
                {getPackageError(index, 'extra_insurance') && (
                  <p className="text-sm text-destructive">
                    {getPackageError(index, 'extra_insurance')}
                  </p>
                )}

                <div className="space-y-2">
                  <Label>{t('order.fields.goodsPhoto')}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingIndex === index}
                      asChild
                    >
                      <label className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingIndex === index
                          ? t('common.loading')
                          : t('order.actions.uploadPhoto')}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handlePhotoUpload(index, e)}
                        />
                      </label>
                    </Button>
                    {watchPackages?.[index]?.goods_photo_url && (
                      <span className="text-sm text-green-600">✓ Photo ajoutée</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {packagesRootError && (
            <p className="text-sm text-destructive">
              {translateValidationKey(packagesRootError, t)}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({
                ...EMPTY_PACKAGE,
                bag_number: computeNextBagNumber(),
              } as unknown as OrderFormData['packages'][number])
            }
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('order.actions.addPackage')}
          </Button>
        </CardContent>
      </Card>
      </motion.div>

      {/* Section obligatoire — Destinataire & logistique */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={formSectionVariants}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t('order.sections.recipient')} *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('order.fields.clientName')} *</Label>
              <Input {...form.register('client_name')} />
              {getError('client_name') && (
                <p className="text-sm text-destructive">{getError('client_name')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Controller
                name="client_phone"
                control={form.control}
                render={({ field }) => (
                  <PhoneInput
                    label={`${t('order.fields.clientPhone')} *`}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={getError('client_phone')}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Controller
                name="floor"
                control={form.control}
                render={({ field }) => (
                  <FloorField
                    label={`${t('order.fields.floor')} *`}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
              {getError('floor') && (
                <p className="text-sm text-destructive">{getError('floor')}</p>
              )}
            </div>
          </div>

          {isOptionEnabled('leave_at_door') && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="leave_at_door"
                checked={form.watch('leave_at_door')}
                onCheckedChange={(c) => form.setValue('leave_at_door', !!c)}
              />
              <Label htmlFor="leave_at_door">{t('order.fields.leaveAtDoor')}</Label>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('order.fields.specialInstructions')}</Label>
            <Textarea {...form.register('special_instructions')} rows={2} />
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Tarif */}
      <motion.div custom={5} initial="hidden" animate="visible" variants={formSectionVariants}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t('order.sections.pricing')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label>{t('order.fields.price')}</Label>
            <Input
              {...form.register('price_chf')}
              type="number"
              step="0.01"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">{t('order.pricing.autoCalculated')}</p>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <motion.div custom={6} initial="hidden" animate="visible" variants={formSectionVariants}>
      <Button type="submit" size="lg" className="w-full sm:w-auto transition-transform active:scale-[0.98]">
        {t('order.actions.continue')}
      </Button>
      </motion.div>
    </form>
  );
}
