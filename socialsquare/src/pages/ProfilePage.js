import { useParams } from 'react-router-dom';
import Profile from './components/Profile';

/**
 * ProfilePage - Full Page Profile Display with Interactions
 * 
 * Uses Profile component to show any user's profile with full features:
 * - For own profile: Edit, Logout, Security, Saved Posts, Collabs
 * - For other profiles: Follow/Unfollow, Mute, Block, Message
 * 
 * Accessible via /profile/:userId route
 * Used for "View full profile" button in UserProfile popup
 */
export default function ProfilePage() {
    const { userId } = useParams();

    if (!userId) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[var(--surface-1)]">
                <p className="text-[var(--text-sub)]">User not found</p>
            </div>
        );
    }

    return (
        <div className="bg-[var(--surface-1)]">
            <div className="flex gap-4 max-w-7xl mx-auto px-4 py-4">
                <main className="flex mx-auto lg:ml-0 ml-0">
                    <div className="max-w-4xl mx-auto">
                        <Profile userId={userId} />
                    </div>
                </main>
            </div>
        </div>
    );
}
