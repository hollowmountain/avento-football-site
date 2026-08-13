'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Pill } from '@/shared/ui/pill';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { isValidTag, normalizeTag } from '../domain/tag';
import { CLUBS } from '../clubs';
import { GENDERS, PROFILE_SKILL_LEVELS, type ProfileDto } from '../schemas';
import { ClubBadge } from './clubs';
import { COUNTRY_CODES, countryName, flagEmoji } from './country';
import { MyGames } from './my-games';

/**
 * Личный кабинет. Пароля нет: профиль привязан к этому браузеру, вход
 * с другого устройства — по личному коду (показывается один раз).
 */
export function ProfileClient() {
  const t = useTranslations('profile');
  // Свежевыданный код живёт на уровне страницы: перерисовка после
  // создания профиля меняет весь экран, а код должен остаться на виду
  const [freshCode, setFreshCode] = useState<{
    code: string;
    source: 'created' | 'rotated';
  } | null>(null);
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<{ profile: ProfileDto | null }>('/api/me'),
  });

  if (me.isPending) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 py-6" aria-busy="true">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const profile = me.data?.profile ?? null;
  return (
    <section className="mx-auto flex max-w-md flex-col gap-4">
      <header className="flex items-baseline gap-3">
        <h1 className="display text-3xl leading-none tracking-tight">{t('title')}</h1>
        {profile !== null ? (
          <span className="flex items-center gap-1.5">
            {profile.countryCode !== null ? (
              <span aria-hidden>{flagEmoji(profile.countryCode)}</span>
            ) : null}
            {profile.club !== null ? <ClubBadge clubId={profile.club} size={18} /> : null}
            <Pill tone="accent">@{profile.tag}</Pill>
          </span>
        ) : null}
      </header>
      {freshCode !== null ? (
        <CodeAlert
          title={freshCode.source === 'created' ? t('form.codeTitle') : t('code.issuedTitle')}
          hint={freshCode.source === 'created' ? t('form.codeHint') : t('code.issuedHint')}
          code={freshCode.code}
        />
      ) : null}
      {profile === null ? (
        <NoProfile onCreated={(code) => setFreshCode({ code, source: 'created' })} />
      ) : (
        <HasProfile
          profile={profile}
          onCodeIssued={(code) => setFreshCode({ code, source: 'rotated' })}
        />
      )}
    </section>
  );
}

/** Одноразовый код с кнопкой копирования — показать и не потерять. */
function CodeAlert({ title, hint, code }: { title: string; hint: string; code: string }) {
  const tCommon = useTranslations('common');
  const [copied, setCopied] = useState(false);

  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{hint}</span>
        <span className="flex items-center gap-2">
          <code className="bg-background min-w-0 flex-1 truncate rounded-md border px-2 py-1 font-mono text-xs">
            {code}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={tCommon('copy')}
            onClick={() => {
              navigator.clipboard
                .writeText(code)
                .then(() => setCopied(true))
                .catch(() => toast.error(tCommon('error')));
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}

// ─── Нет профиля: создать или войти по коду ─────────────────────────────

function NoProfile({ onCreated }: { onCreated: (code: string) => void }) {
  const t = useTranslations('profile');
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="display text-xl tracking-wide">{t('create.title')}</CardTitle>
          <CardDescription>{t('create.lead')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm mode="create" onCreated={onCreated} />
        </CardContent>
      </Card>
      <LoginCard />
    </>
  );
}

function LoginCard() {
  const t = useTranslations('profile.login');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');

  const login = useMutation({
    mutationFn: (value: string) =>
      apiFetch<{ profile: ProfileDto }>('/api/me/login', {
        method: 'POST',
        body: JSON.stringify({ code: value }),
      }),
    onSuccess: async () => {
      toast.success(t('done'));
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
    },
  });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="display text-base tracking-wide">{t('title')}</CardTitle>
        <CardDescription>{t('lead')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim().length >= 16) login.mutate(code);
          }}
        >
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t('placeholder')}
            className="min-w-40 flex-1 font-mono text-xs"
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={code.trim().length < 16 || login.isPending}
          >
            <KeyRound data-icon="inline-start" aria-hidden />
            {t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Профиль есть: данные, правка, код ──────────────────────────────────

function HasProfile({
  profile,
  onCodeIssued,
}: {
  profile: ProfileDto;
  onCodeIssued: (code: string) => void;
}) {
  const t = useTranslations('profile');
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="display text-xl tracking-wide">
            <UserRound className="mr-1.5 inline size-4 align-[-2px]" aria-hidden />
            {profile.displayName}
          </CardTitle>
          <CardDescription>{t('edit.lead')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm mode="edit" initial={profile} />
        </CardContent>
      </Card>
      <MyGames />
      <CodeCard onCodeIssued={onCodeIssued} />
    </>
  );
}

function CodeCard({ onCodeIssued }: { onCodeIssued: (code: string) => void }) {
  const t = useTranslations('profile.code');
  const tCommon = useTranslations('common');

  const rotate = useMutation({
    mutationFn: () => apiFetch<{ loginCode: string }>('/api/me/code', { method: 'POST' }),
    onSuccess: (data) => onCodeIssued(data.loginCode),
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
    },
  });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="display text-base tracking-wide">{t('title')}</CardTitle>
        <CardDescription>{t('lead')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          disabled={rotate.isPending}
          onClick={() => rotate.mutate()}
        >
          <KeyRound data-icon="inline-start" aria-hidden />
          {t('reissue')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Форма профиля (создание и правка) ──────────────────────────────────

/** Живой статус тега: подсказка «свободен/занят» прямо при вводе. */
function useTagStatus(rawTag: string) {
  const [debounced, setDebounced] = useState('');

  const normalized = normalizeTag(rawTag);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(normalized), 350);
    return () => clearTimeout(id);
  }, [normalized]);

  const check = useQuery({
    queryKey: ['tag-check', debounced],
    queryFn: () =>
      apiFetch<{ status: 'invalid' | 'free' | 'taken' | 'yours' }>(
        `/api/me/tag?tag=${encodeURIComponent(debounced)}`,
      ),
    enabled: isValidTag(debounced),
    staleTime: 10_000,
  });

  if (normalized.length < 3) return null;
  if (!isValidTag(normalized)) return 'invalid' as const;
  if (debounced !== normalized || check.isPending) return 'checking' as const;
  return check.data?.status ?? null;
}

function ProfileForm({
  mode,
  initial,
  onCreated,
}: {
  mode: 'create' | 'edit';
  initial?: ProfileDto;
  onCreated?: (code: string) => void;
}) {
  const t = useTranslations('profile.form');
  const tGenders = useTranslations('profile.genders');
  const tLevels = useTranslations('levels');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [tag, setTag] = useState(initial?.tag ?? '');
  const [age, setAge] = useState(
    initial?.age === null || initial === undefined ? '' : String(initial.age),
  );
  const [gender, setGender] = useState<string>(initial?.gender ?? '');
  const [country, setCountry] = useState<string>(initial?.countryCode ?? 'none');
  const [club, setClub] = useState<string>(initial?.club ?? '');
  const [level, setLevel] = useState<string>(
    initial === undefined || initial.skillLevel === 'ANY' ? '' : initial.skillLevel,
  );
  const tagStatus = useTagStatus(tag);

  const save = useMutation({
    mutationFn: (body: {
      displayName: string;
      tag: string;
      age: number | null;
      gender: string | null;
      countryCode: string | null;
      club: string | null;
      skillLevel: string | null;
    }) =>
      apiFetch<{ profile: ProfileDto; loginCode?: string }>('/api/me', {
        method: mode === 'create' ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async (data) => {
      if (mode === 'create' && data.loginCode !== undefined) {
        onCreated?.(data.loginCode);
      } else {
        toast.success(t('saved'));
      }
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
    },
  });

  const submit = () => {
    const parsedAge = age.trim() === '' ? null : Number(age);
    save.mutate({
      displayName: displayName.trim(),
      tag: tag.trim(),
      age: parsedAge !== null && Number.isFinite(parsedAge) ? parsedAge : null,
      gender: gender === '' ? null : gender,
      countryCode: country === 'none' ? null : country,
      club: club === '' ? null : club,
      skillLevel: level === '' ? null : level,
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">{t('name')}</Label>
        <Input
          id="profile-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={t('namePlaceholder')}
          maxLength={60}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-tag">{t('tag')}</Label>
        <div className="flex items-center gap-1.5">
          <span className="text-lamp text-lg font-semibold" aria-hidden>
            @
          </span>
          <Input
            id="profile-tag"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder={t('tagPlaceholder')}
            maxLength={20}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
        {tagStatus === 'free' ? (
          <p className="text-success text-xs">{t('tagFree')}</p>
        ) : tagStatus === 'taken' ? (
          <p role="alert" className="text-destructive text-xs">
            {t('tagTaken')}
          </p>
        ) : tagStatus === 'yours' ? (
          <p className="text-success text-xs">{t('tagYours')}</p>
        ) : (
          <p className="text-muted-foreground text-xs">{t('tagHint')}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-age">{t('age')}</Label>
          <Input
            id="profile-age"
            value={age}
            onChange={(event) => setAge(event.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            placeholder={t('agePlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('gender')}</Label>
          <div className="flex gap-1.5" role="group" aria-label={t('gender')}>
            {GENDERS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={gender === value ? 'secondary' : 'outline'}
                aria-pressed={gender === value}
                onClick={() => setGender(gender === value ? '' : value)}
              >
                {tGenders(value)}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t('level')}</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('level')}>
          {PROFILE_SKILL_LEVELS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={level === value ? 'secondary' : 'outline'}
              aria-pressed={level === value}
              onClick={() => setLevel(level === value ? '' : value)}
            >
              {tLevels(value)}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t('levelHint')}</p>
      </div>
      <div className="space-y-1.5">
        <Label>{t('country')}</Label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('countryNone')}</SelectItem>
            {COUNTRY_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {flagEmoji(code)} {countryName(code, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">{t('countryHint')}</p>
      </div>
      <div className="space-y-1.5">
        <Label>{t('club')}</Label>
        <div
          className="grid grid-cols-4 gap-1.5 sm:grid-cols-5"
          role="group"
          aria-label={t('club')}
        >
          {CLUBS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={club === preset.id}
              onClick={() => setClub(club === preset.id ? '' : preset.id)}
              className={`focus-visible:ring-ring flex flex-col items-center gap-1 rounded-md border px-1 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                club === preset.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <ClubBadge clubId={preset.id} size={28} />
              <span className="text-muted-foreground w-full truncate text-center text-[0.6rem] leading-tight">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t('clubHint')}</p>
      </div>
      <Button
        type="submit"
        className="display self-start text-base tracking-wide"
        disabled={
          displayName.trim().length < 2 ||
          tag.trim().length < 3 ||
          tagStatus === 'taken' ||
          save.isPending
        }
      >
        {mode === 'create' ? t('createSubmit') : t('editSubmit')}
      </Button>
    </form>
  );
}
