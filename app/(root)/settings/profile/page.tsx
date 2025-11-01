import ProfileForm from '@/components/ProfileForm';
import { getCurrentUserProfile } from '@/lib/actions/user.actions';

export default async function ProfileSettingsPage() {
  const user = await getCurrentUserProfile();

  return (
    <section className="p-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-200 mb-2">Profile</h1>
        <p className="text-gray-500 mb-6">Update your display name, profile picture, and email preferences.</p>
        <ProfileForm initial={{ name: user.name, email: user.email, image: user.image, dailyNews: user?.emailPrefs?.dailyNews !== false }} />
      </div>
    </section>
  );
}
