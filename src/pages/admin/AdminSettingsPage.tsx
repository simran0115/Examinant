import { useState, useEffect } from 'react';
import { Save, User, Lock, Bell, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db, auth } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const AdminSettingsPage = () => {
    const { currentUser, userData } = useAuth() || {};
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    
    // Profile State
    const [displayName, setDisplayName] = useState('');
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    
    // Password Modal State
    const [isPassModalOpen, setIsPassModalOpen] = useState(false);
    const [passData, setPassData] = useState({
        current: '',
        new: '',
        confirm: ''
    });
    const [passError, setPassError] = useState('');
    const [passLoading, setPassLoading] = useState(false);
    const [passSuccess, setPassSuccess] = useState(false);

    useEffect(() => {
        if (userData) {
            setDisplayName(userData.displayName || currentUser?.displayName || '');
            setIs2FAEnabled(userData.twoFactorEnabled || false);
        } else if (currentUser) {
            setDisplayName(currentUser.displayName || '');
        }
    }, [userData, currentUser]);

    const handleSaveGeneral = async () => {
        if (!currentUser) return;
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                displayName,
                twoFactorEnabled: is2FAEnabled,
                updatedAt: new Date().toISOString()
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Error updating settings:", error);
            alert("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !currentUser.email) return;
        if (passData.new !== passData.confirm) {
            setPassError("Passwords do not match");
            return;
        }
        if (passData.new.length < 6) {
            setPassError("Password must be at least 6 characters");
            return;
        }

        setPassLoading(true);
        setPassError('');
        try {
            // Re-authenticate
            const credential = EmailAuthProvider.credential(currentUser.email, passData.current);
            await reauthenticateWithCredential(currentUser, credential);
            
            // Update password
            await updatePassword(currentUser, passData.new);
            
            setPassSuccess(true);
            setTimeout(() => {
                setIsPassModalOpen(false);
                setPassSuccess(false);
                setPassData({ current: '', new: '', confirm: '' });
            }, 2000);
        } catch (error: any) {
            console.error("Password change error:", error);
            if (error.code === 'auth/wrong-password') {
                setPassError("Incorrect current password");
            } else {
                setPassError("Failed to update password. Please try again.");
            }
        } finally {
            setPassLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage platform configuration and preferences.</p>
                </div>
                <button 
                    onClick={handleSaveGeneral}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-6 py-2.5 ${saveSuccess ? 'bg-green-600' : 'bg-teal-600'} text-white font-bold rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50`}
                >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : saveSuccess ? <Check size={18} /> : <Save size={18} />}
                    {saveSuccess ? 'Saved!' : 'Save Changes'}
                </button>
            </div>

            <div className="space-y-6">
                {/* Profile Settings */}
                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
                    <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <User size={20} className="text-teal-600" /> Profile Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Display Name</label>
                            <input 
                                type="text" 
                                value={displayName} 
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-teal-500 text-sm" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Email Address</label>
                            <input 
                                type="email" 
                                value={currentUser?.email || ''} 
                                className="w-full px-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-teal-500 bg-slate-50 text-sm" 
                                readOnly 
                            />
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
                    <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Bell size={20} className="text-teal-600" /> Notifications
                    </h3>
                    <div className="space-y-3">
                        {['Email me when a new student registers', 'Email me when a test is purchased', 'Weekly performance summary'].map((label, i) => (
                            <label key={i} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors">
                                <input type="checkbox" defaultChecked className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500 border-slate-300" />
                                <span className="text-slate-700 text-sm font-medium">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Password & Security */}
                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
                    <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Lock size={20} className="text-teal-600" /> Security
                    </h3>
                    <div className="space-y-4 max-w-md">
                        <button 
                            onClick={() => setIsPassModalOpen(true)}
                            className="text-teal-600 text-sm font-semibold hover:underline flex items-center gap-2"
                        >
                            Change Password
                        </button>
                        <div className="pt-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <span className="text-slate-700 text-sm font-medium">Two-Factor Authentication</span>
                                <div 
                                    onClick={() => setIs2FAEnabled(!is2FAEnabled)}
                                    className={`w-11 h-6 ${is2FAEnabled ? 'bg-teal-600' : 'bg-slate-200'} rounded-full relative transition-colors`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${is2FAEnabled ? 'left-6' : 'left-1'}`}></div>
                                </div>
                            </label>
                            <p className="text-xs text-slate-500 mt-2">Add an extra layer of security to your account.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Password Modal */}
            {isPassModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white w-full max-w-md rounded-md border border-slate-200 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800">Change Password</h2>
                            <button onClick={() => setIsPassModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <AlertCircle size={20} className="rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
                            {passError && (
                                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-md flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {passError}
                                </div>
                            )}
                            {passSuccess && (
                                <div className="p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-md flex items-center gap-2">
                                    <Check size={16} />
                                    Password updated successfully!
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Current Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={passData.current}
                                    onChange={(e) => setPassData({...passData, current: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-teal-500 text-sm" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">New Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={passData.new}
                                    onChange={(e) => setPassData({...passData, new: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-teal-500 text-sm" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Confirm New Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={passData.confirm}
                                    onChange={(e) => setPassData({...passData, confirm: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-teal-500 text-sm" 
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsPassModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-md hover:bg-slate-50 transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={passLoading || passSuccess}
                                    className="flex-1 px-4 py-2 bg-teal-600 text-white font-semibold rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                                >
                                    {passLoading ? <Loader2 className="animate-spin" size={18} /> : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSettingsPage;
