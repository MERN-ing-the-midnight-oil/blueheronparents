import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase.config';

/**
 * Check if the current user is an admin
 * @returns Promise<boolean> - true if user is admin, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            return data.isAdmin === true;
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
    return false;
}

/**
 * Check if a specific user ID is an admin
 * @param userId - The user ID to check
 * @returns Promise<boolean> - true if user is admin, false otherwise
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const data = userDoc.data();
            return data.isAdmin === true;
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
    return false;
}


