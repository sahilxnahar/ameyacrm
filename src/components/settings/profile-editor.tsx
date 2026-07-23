'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { Loader2, Camera, ShieldCheck } from 'lucide-react';
import { updateMyProfile } from '@/server/actions/profile';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { initials } from '@/lib/utils/format';

export interface ProfileInit {
  name: string;
  email: string;
  username: string;
  phone: string | null;
  whatsappNumber: string | null;
  designation: string | null;
  avatarUrl: string | null;
  employeeId: string | null;
  department: string | null;
  roleLabel: string;
  joined: string;
}

export function ProfileEditor({ init }: { init: ProfileInit }) {
  const router = useRouter();
  const [name, setName] = React.useState(init.name);
  const [phone, setPhone] = React.useState(init.phone ?? '');
  const [whatsapp, setWhatsapp] = React.useState(init.whatsappNumber ?? '');
  const [designation, setDesignation] = React.useState(init.designation ?? '');
  const [avatarUrl, setAvatarUrl] = React.useState(init.avatarUrl ?? '');
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const pickPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image.'); return; }
    setUploading(true);
    try {
      const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload' });
      setAvatarUrl(blob.url);
      toast.success('Photo ready — remember to Save.');
    } catch {
      toast.error('Could not upload the photo. Try again.');
    } finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    const r = await updateMyProfile({ name, phone, whatsappNumber: whatsapp, designation, avatarUrl });
    setSaving(false);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Profile saved');
    router.refresh();
  };

  const field = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none';

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-5 p-5 sm:p-6">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback className="text-xl">{initials(name || init.name)}</AvatarFallback>
          </Avatar>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickPhoto(f); e.target.value = ''; }} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {avatarUrl ? 'Change photo' : 'Add photo'}
            </Button>
            {avatarUrl && <button onClick={() => setAvatarUrl('')} className="ml-2 text-xs text-muted-foreground hover:text-destructive">Remove</button>}
          </div>
        </div>

        {/* Editable fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">Full name</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">Designation</span>
            <input className={field} value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Sales Manager" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">Phone</span>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" inputMode="tel" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">WhatsApp number</span>
            <input className={field} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="For click-to-chat" inputMode="tel" /></label>
        </div>

        {/* Read-only info, incl. role so you know what you can do */}
        <div className="grid gap-4 rounded-lg border bg-secondary/30 p-3 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Username</p><p className="font-medium">{init.username}</p></div>
          <div><p className="text-xs text-muted-foreground">Email</p><p className="truncate font-medium">{init.email}</p></div>
          <div><p className="text-xs text-muted-foreground">Employee ID</p><p className="font-medium">{init.employeeId ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Department</p><p className="font-medium">{init.department ?? '—'}</p></div>
          <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Role</p><p className="font-medium text-primary">{init.roleLabel}</p></div>
          <div><p className="text-xs text-muted-foreground">Joined</p><p className="font-medium">{init.joined}</p></div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || uploading}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save profile</Button>
        </div>
      </CardContent>
    </Card>
  );
}
