'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Pill } from '@/shared/ui/pill';
import { Skeleton } from '@/shared/ui/skeleton';
import { GENDERS, type ProfileDto } from '../schemas';

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
        {profile !== null ? <Pill tone="accent">@{profile.tag}</Pill> : null}
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
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [tag, setTag] = useState(initial?.tag ?? '');
  const [age, setAge] = useState(
    initial?.age === null || initial === undefined ? '' : String(initial.age),
  );
  const [gender, setGender] = useState<string>(initial?.gender ?? '');

  const save = useMutation({
    mutationFn: (body: {
      displayName: string;
      tag: string;
      age: number | null;
      gender: string | null;
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
        <p className="text-muted-foreground text-xs">{t('tagHint')}</p>
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
      <Button
        type="submit"
        className="display self-start text-base tracking-wide"
        disabled={displayName.trim().length < 2 || tag.trim().length < 3 || save.isPending}
      >
        {mode === 'create' ? t('createSubmit') : t('editSubmit')}
      </Button>
    </form>
  );
}
