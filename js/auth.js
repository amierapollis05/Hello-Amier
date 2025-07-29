// Authentication Module
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initializeAuthListener();
    }

    // Initialize authentication state listener
    initializeAuthListener() {
        auth.onAuthStateChanged((user) => {
            if (user && Utils.isAuthorizedUser(user.email)) {
                this.currentUser = user;
                AppState.currentUser = user;
                this.showMainApp();
                this.updateUserInfo();
                AppEvents.emit('userAuthenticated', user);
            } else if (user && !Utils.isAuthorizedUser(user.email)) {
                // User is signed in but not authorized
                this.signOut();
                Utils.showToast('Access denied. You are not authorized to use this system.', 'error');
            } else {
                this.currentUser = null;
                AppState.currentUser = null;
                this.showLoginScreen();
                AppEvents.emit('userSignedOut');
            }
        });
    }

    // Sign in with email and password
    async signIn(email, password) {
        try {
            Utils.showLoading();
            
            // Check if user is authorized before attempting sign in
            if (!Utils.isAuthorizedUser(email)) {
                throw new Error('Access denied. You are not authorized to use this system.');
            }

            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            Utils.hideLoading();
            
            Utils.showToast('Successfully signed in!', 'success');
            return userCredential.user;
        } catch (error) {
            Utils.hideLoading();
            this.handleAuthError(error);
            throw error;
        }
    }

    // Sign out
    async signOut() {
        try {
            await auth.signOut();
            Utils.showToast('Successfully signed out!', 'info');
        } catch (error) {
            console.error('Sign out error:', error);
            Utils.showToast('Error signing out. Please try again.', 'error');
        }
    }

    // Create new user account (admin only)
    async createUser(email, password, displayName) {
        try {
            if (!Utils.isAuthorizedUser(email)) {
                throw new Error('Cannot create account for unauthorized email.');
            }

            Utils.showLoading();
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            
            // Update user profile
            await userCredential.user.updateProfile({
                displayName: displayName
            });

            Utils.hideLoading();
            Utils.showToast('User account created successfully!', 'success');
            return userCredential.user;
        } catch (error) {
            Utils.hideLoading();
            this.handleAuthError(error);
            throw error;
        }
    }

    // Reset password
    async resetPassword(email) {
        try {
            if (!Utils.isAuthorizedUser(email)) {
                throw new Error('Password reset is only available for authorized users.');
            }

            await auth.sendPasswordResetEmail(email);
            Utils.showToast('Password reset email sent!', 'success');
        } catch (error) {
            this.handleAuthError(error);
            throw error;
        }
    }

    // Handle authentication errors
    handleAuthError(error) {
        let message = 'An error occurred. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No account found with this email address.';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                message = 'Please enter a valid email address.';
                break;
            case 'auth/user-disabled':
                message = 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/network-request-failed':
                message = 'Network error. Please check your connection.';
                break;
            case 'auth/email-already-in-use':
                message = 'An account with this email already exists.';
                break;
            case 'auth/weak-password':
                message = 'Password should be at least 6 characters long.';
                break;
            default:
                message = error.message || message;
        }

        this.showLoginError(message);
        Utils.showToast(message, 'error');
    }

    // Show login error
    showLoginError(message) {
        const errorElement = document.getElementById('login-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
            
            // Hide error after 5 seconds
            setTimeout(() => {
                errorElement.classList.remove('show');
            }, 5000);
        }
    }

    // Show main application
    showMainApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'grid';
        Utils.hideLoading();
    }

    // Show login screen
    showLoginScreen() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
        Utils.hideLoading();
    }

    // Update user info in header
    updateUserInfo() {
        const currentUserElement = document.getElementById('current-user');
        if (currentUserElement && this.currentUser) {
            const displayName = this.currentUser.displayName || 
                              this.currentUser.email.split('@')[0];
            currentUserElement.textContent = displayName;
        }
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Get user role (for future role-based access)
    getUserRole() {
        if (!this.currentUser) return null;
        
        // For now, both co-founders have admin role
        if (Utils.isAuthorizedUser(this.currentUser.email)) {
            return 'admin';
        }
        
        return null;
    }
}

// Initialize authentication manager
const authManager = new AuthManager();

// Login form handler
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email || !password) {
                authManager.showLoginError('Please enter both email and password.');
                return;
            }

            if (!Utils.isValidEmail(email)) {
                authManager.showLoginError('Please enter a valid email address.');
                return;
            }

            try {
                await authManager.signIn(email, password);
            } catch (error) {
                console.error('Login error:', error);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to sign out?')) {
                await authManager.signOut();
            }
        });
    }

    // Handle Enter key on login form
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });
});

// Export for use in other modules
window.authManager = authManager;