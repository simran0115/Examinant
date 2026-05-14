import { useState, useEffect } from 'react';
import { Search, FileText, Video, ExternalLink, Loader2, BookOpen, Lock } from 'lucide-react';
import { db } from '../../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { loadRazorpay } from '../../utils/razorpay';
import { marketplaceService } from '../../services/marketplaceService';

interface Resource {
    id: string;
    title: string;
    description: string;
    type: 'pdf' | 'video' | 'link';
    category: string;
    url: string;
    isFree: boolean;
    price?: number;
    createdAt: any;
}

const StudentResourcesPage = () => {
    const authContext = useAuth();
    const currentUser = authContext?.currentUser;
    const [resources, setResources] = useState<Resource[]>([]);
    const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [buyingId, setBuyingId] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser) return;

        // Fetch purchases
        const purchasesRef = collection(db, 'users', currentUser.uid, 'purchases');
        const unsubscribePurchases = onSnapshot(purchasesRef, (snapshot) => {
            const ids = new Set(snapshot.docs.map(doc => doc.data().itemId));
            setPurchasedIds(ids);
        });

        // Fetch resources
        const q = query(collection(db, 'resources')); // Removed orderBy
        const unsubscribeResources = onSnapshot(q, (snapshot) => {
            const fetchedResources = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Resource[];
            console.log("Fetched Resources:", fetchedResources.length);
            setResources(fetchedResources);
            setIsLoading(false);
        }, (error) => {
            console.error("Resources subscription error:", error);
            setIsLoading(false);
            alert("Error loading Resources: " + error.message);
        });

        return () => {
            unsubscribePurchases();
            unsubscribeResources();
        };
    }, [currentUser]);

    const handleBuy = async (resource: Resource) => {
        if (!currentUser) return;
        setBuyingId(resource.id);
        try {
            const res = await loadRazorpay();
            if (!res) {
                alert('Razorpay SDK failed to load. Are you online?');
                setBuyingId(null);
                return;
            }

            const options = {
                key: 'rzp_test_S7lSvWtu89c6zD',
                amount: (resource.price || 0) * 100,
                currency: 'INR',
                name: 'DHItantra',
                description: `Unlock ${resource.title}`,
                image: 'https://DHItantra.web.app/logo192.png',
                handler: async function (_response: any) {
                    try {
                        await marketplaceService.enrollInItem(currentUser.uid, {
                            id: resource.id,
                            title: resource.title,
                            price: resource.price || 0,
                            type: 'resource'
                        });
                        alert("Unlocked successfully!");
                        // onSnapshot will handle the UI update automatically
                    } catch (err) {
                        console.error("Enrollment error after payment:", err);
                        alert("Payment successful but enrollment failed. Please contact support.");
                    }
                },
                prefill: {
                    name: currentUser.displayName || 'Student',
                    email: currentUser.email || '',
                },
                theme: { color: '#3399cc' }
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.open();
        } catch (error) {
            console.error("Payment flow failed:", error);
            alert("Failed to initiate payment. Please try again.");
        } finally {
            setBuyingId(null);
        }
    };

    const categories = ['All', ...Array.from(new Set(resources.map((r: Resource) => r.category)))];

    const filteredResources = resources.filter((item: Resource) => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'pdf': return <FileText size={24} className="text-red-500" />;
            case 'video': return <Video size={24} className="text-teal-500" />;
            default: return <ExternalLink size={24} className="text-emerald-500" />;
        }
    };



    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Study Resources</h1>
                    <p className="text-slate-500 mt-1">Access notes, video lectures, and reference materials.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-md border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search topics, notes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-teal-500"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ${selectedCategory === cat
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Resources Grid */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-teal-600" size={40} />
                </div>
            ) : filteredResources.length === 0 ? (
                <div className="text-center py-20">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">No resources found</h3>
                    <p className="text-slate-500 text-sm">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredResources.map((resource) => {
                        const isUnlocked = resource.isFree || purchasedIds.has(resource.id);
                        const price = resource.price || 0;

                        return (
                            <div
                                key={resource.id}
                                className="bg-white rounded-md p-6 border border-slate-200 shadow-sm hover:border-teal-400 transition-all group relative overflow-hidden flex flex-col"
                            >
                                <div className={`absolute top-0 right-0 px-3 py-1 bg-${isUnlocked ? 'green' : 'amber'}-100 text-${isUnlocked ? 'green' : 'amber'}-700 text-xs font-bold rounded-bl-xl`}>
                                    {resource.isFree ? 'FREE' : isUnlocked ? 'ACTIVE' : `₹${price}`}
                                </div>

                                <div className="flex items-start gap-4 mb-4">
                                    <div className="p-3 bg-slate-50 rounded-md group-hover:bg-teal-50 transition-colors">
                                        {getIcon(resource.type)}
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{resource.category}</span>
                                        <h3 className="font-bold text-slate-800 line-clamp-2 mt-1">{resource.title}</h3>
                                    </div>
                                </div>

                                <p className="text-slate-500 text-sm mb-6 line-clamp-3 h-10">
                                    {resource.description}
                                </p>

                                <div className="mt-auto">
                                    {isUnlocked ? (
                                        <a
                                            href={resource.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white font-bold rounded-md hover:bg-slate-800 transition-all"
                                        >
                                            {resource.type === 'video' ? 'Watch Video' : resource.type === 'pdf' ? 'Open PDF' : 'Visit Link'}
                                            <ExternalLink size={16} />
                                        </a>
                                    ) : (
                                        <button
                                            onClick={() => handleBuy(resource)}
                                            disabled={buyingId === resource.id}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 text-white font-bold rounded-md hover:bg-teal-700 transition-all disabled:opacity-70"
                                        >
                                            {buyingId === resource.id ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
                                            Unlock Premium
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default StudentResourcesPage;

