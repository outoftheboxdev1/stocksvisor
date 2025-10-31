import Header from "@/components/Header";
import {auth} from "@/lib/better-auth/auth";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import { getCurrentUserProfile } from "@/lib/actions/user.actions";

const Layout = async ({ children }: { children : React.ReactNode }) => {
    const session = await auth.api.getSession({ headers: await headers() });

    if(!session?.user) redirect('/sign-in');

    // Load the freshest user profile (including image) from the database,
    // falling back to session values if needed.
    const profile = await getCurrentUserProfile();

    const user = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        image: profile.image || undefined,
    } as User;

    return (
        <main className="min-h-screen text-gray-400">
            <Header user={user} />

            <div className="container py-10">
                {children}
            </div>
        </main>
    )
}
export default Layout