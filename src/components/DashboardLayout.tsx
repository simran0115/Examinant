import { type ReactNode, useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    BookOpen,
    TrendingUp,
    Settings,
    LogOut,
    FileText,
    Users,
    Menu,
    X,
    Bell,
    BookMarked,
    FolderTree,
    Award,
    ListChecks,
    User as UserIcon,
    Camera,
    Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth, db, storage } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
const logo = "/logo.png";

interface DashboardLayoutProps {
    children: ReactNode;
    role: 'student' | 'admin';
}

const DashboardLayout = ({ children, role }: DashboardLayoutProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const authContext = useAuth();
    const currentUser = authContext?.currentUser;
    const navigate = useNavigate();

    // Dropdown states
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const profileMenuRef = useRef<HTMLDivElement>(null);
    const notificationMenuRef = useRef<HTMLDivElement>(null);

    // Profile Edit States
    const [displayName, setDisplayName] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const userData = authContext?.userData;

    useEffect(() => {
        if (currentUser) {
            setDisplayName(userData?.displayName || currentUser.displayName || '');
            setPreviewUrl(userData?.photoURL || currentUser.photoURL || null);
        }
    }, [currentUser, userData]);

    // Close dropdowns on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
            if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
                setIsNotificationOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSaveProfile = async () => {
        if (!currentUser) return;
        setSavingProfile(true);
        try {
            let photoURL = currentUser.photoURL;

            if (avatarFile) {
                setUploadingAvatar(true);
                // Base64 Workaround: Convert file to string instead of uploading to Storage
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(avatarFile);
                });
                
                photoURL = await base64Promise;
                setUploadingAvatar(false);
            }

            // Only update displayName in Auth (as photoURL Base64 is too long for Auth)
            await updateProfile(currentUser, {
                displayName
            });

            await setDoc(doc(db, 'users', currentUser.uid), {
                displayName,
                photoURL
            }, { merge: true });

            alert('Profile updated successfully!');
            setIsProfileModalOpen(false);
        } catch (error: any) {
            console.error("Error updating profile:", error);
            alert(`Failed to update profile: ${error.message || 'Unknown error'}`);
            setUploadingAvatar(false);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleLogout = async () => {
        try {
            await auth.signOut();
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const studentLinks = [
        { icon: <LayoutDashboard size={20} />, label: 'Overview', path: '/dashboard', end: true },
        { icon: <BookOpen size={20} />, label: 'My Tests', path: '/dashboard/tests' },
        { icon: <FileText size={20} />, label: 'PYQs', path: '/dashboard/pyqs' },
        { icon: <FolderTree size={20} />, label: 'Resources', path: '/dashboard/resources' },
        { icon: <Award size={20} />, label: 'Test Results', path: '/dashboard/results' },
        { icon: <ListChecks size={20} />, label: 'Marketplace', path: '/dashboard/market' },
        { icon: <TrendingUp size={20} />, label: 'Analytics', path: '/dashboard/analytics' },
    ];

    const adminLinks = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/admin-dashboard' },
        { icon: <ListChecks size={20} />, label: 'Test Series', path: '/admin-dashboard/test-series' },
        { icon: <BookMarked size={20} />, label: 'Question Bank', path: '/admin-dashboard/question-bank' },
        { icon: <FolderTree size={20} />, label: 'Chapters', path: '/admin-dashboard/chapters' },
        { icon: <BookOpen size={20} />, label: 'Manage Tests', path: '/admin-dashboard/tests' },
        { icon: <Award size={20} />, label: 'Subjects', path: '/admin-dashboard/subjects' },
        { icon: <FolderTree size={20} />, label: 'Classes', path: '/admin-dashboard/classes' },
        { icon: <BookOpen size={20} />, label: 'Resources', path: '/admin-dashboard/resources' },
        { icon: <Users size={20} />, label: 'Students', path: '/admin-dashboard/students' },
        { icon: <Settings size={20} />, label: 'Settings', path: '/admin-dashboard/settings' },
    ];

    const links = role === 'admin' ? adminLinks : studentLinks;

    // Determine theme based on role or globally (For now enforcing Dark for Admin as requested, but Layout wraps both. 
    // We'll apply Dark Theme generally as the user implies a system-wide design change or at least for the Admin view).
    // The screenshot implies a global dark theme app.
    const isDarkTheme = false; // Could be a prop or context later.

    return (
        <div className={`min-h-screen flex ${isDarkTheme ? 'bg-[#0B0F19] text-white' : 'bg-slate-50 text-slate-900'}`}>
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:sticky top-0 h-screen w-64 
                    bg-slate-50 border-slate-200
                    border-r z-50 transition-transform duration-300 ease-in-out
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    flex flex-col print:hidden
                `}
            >
                {/* Logo Area */}
                <div className="px-5 py-6 flex items-center gap-3">
                    <img src={logo} alt="Logo" className={`w-8 h-8 rounded-md p-0.5 bg-white border border-slate-200`} />
                    <div>
                        <h2 className={`text-base font-bold text-slate-800 tracking-tight leading-tight`}>
                            DHItantra
                        </h2>
                        <p className={`text-xs text-slate-500`}>
                            {role === 'admin' ? 'Admin Portal' : 'Student Portal'}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className={`ml-auto lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200`}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Separator */}
                <div className={`h-px bg-slate-200 mx-5 mb-4`}></div>

                {/* Navigation */}
                <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-hide py-2">
                    {links.map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.end}
                            onClick={() => setIsSidebarOpen(false)}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium
                                ${isActive
                                    ? 'bg-teal-50 text-teal-700 shadow-sm'
                                    : `text-slate-600 hover:bg-slate-100 hover:text-slate-900`
                                }
                            `}
                        >
                            {({ isActive }) => (
                                <>
                                    <span className={`transition-transform duration-200 ${isActive ? 'text-teal-600' : 'text-slate-400'}`}>
                                        {link.icon}
                                    </span>
                                    <span>{link.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>


            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className={`sticky top-0 z-30 px-6 py-3 flex items-center justify-between border-b bg-white border-slate-200 print:hidden`}>
                    <div className="flex items-center gap-3 md:gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className={`lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100`}
                        >
                            <Menu size={18} />
                        </button>
                        <div className="min-w-0">
                            <h1 className={`text-base md:text-lg font-semibold truncate text-slate-800`}>
                                {role === 'admin' ? 'Admin Portal' : 'Student Dashboard'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Notifications Dropdown */}
                        <div className="relative" ref={notificationMenuRef}>
                            <button 
                                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                                className={`relative p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 ${isNotificationOpen ? 'bg-slate-100 text-slate-700' : ''}`}
                            >
                                <Bell size={18} />
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-teal-500 rounded-full border border-white"></span>
                            </button>
                            
                            {isNotificationOpen && (
                                <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg border border-slate-200 py-2 z-50">
                                    <div className="px-4 py-2 border-b border-slate-100">
                                        <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
                                    </div>
                                    <div className="p-4 text-center">
                                        <p className="text-sm text-slate-500">No new notifications.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile Dropdown */}
                        <div className={`flex items-center gap-3 pl-3 border-l border-slate-200 relative`} ref={profileMenuRef}>
                            <div className="text-right hidden lg:block">
                                <p className={`text-sm font-medium text-slate-700`}>{userData?.displayName || currentUser?.displayName || 'User'}</p>
                                <p className={`text-xs text-slate-500`}>
                                    {currentUser?.email}
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                className="focus:outline-none"
                            >
                                {(userData?.photoURL || currentUser?.photoURL) ? (
                                    <img src={userData?.photoURL || currentUser?.photoURL} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-medium">
                                        {currentUser?.email?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                            </button>

                            {isProfileMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50">
                                    <button 
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            setIsProfileModalOpen(true);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                        <UserIcon size={16} /> Profile Settings
                                    </button>
                                    <div className="h-px bg-slate-100 my-1"></div>
                                    <button 
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-x-hidden pt-4">
                    {children}
                </main>
            </div>

            {/* Profile Settings Modal */}
            {isProfileModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsProfileModalOpen(false)}>
                    <div 
                        className="bg-white rounded-md shadow-xl max-w-md w-full overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-800">Profile Settings</h2>
                            <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center">
                                <div className="relative group">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Preview" className="w-24 h-24 rounded-full object-cover border-2 border-slate-200" />
                                    ) : (
                                        <div className="w-24 h-24 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-3xl font-bold border-2 border-slate-200">
                                            {currentUser?.email?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                    )}
                                    <label htmlFor="avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                        <Camera className="text-white" size={24} />
                                    </label>
                                    <input 
                                        type="file" 
                                        id="avatar-upload" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={handleAvatarChange}
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Click to change avatar</p>
                            </div>

                            {/* Form */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <input 
                                        type="email" 
                                        value={currentUser?.email || ''} 
                                        disabled
                                        className="w-full px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-500 sm:text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                                    <input 
                                        type="text" 
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                                        placeholder="Enter your name"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button 
                                onClick={() => setIsProfileModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveProfile}
                                disabled={savingProfile || uploadingAvatar}
                                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md transition-colors flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {(savingProfile || uploadingAvatar) ? (
                                    <><Loader2 className="animate-spin mr-2" size={16} /> Saving...</>
                                ) : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardLayout;
