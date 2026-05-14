import { useState, useEffect } from 'react';
import { Search, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { db } from '../../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import type { TestSeries } from '../../types/test.types';
import { getAllTestSeries } from '../../services/testSeriesService';
import TestSeriesCard from '../../components/landing/TestSeriesCard';
import { marketplaceService } from '../../services/marketplaceService';

const StudentMarketPage = () => {
    const authContext = useAuth();
    const currentUser = authContext?.currentUser;
    const [tests, setTests] = useState<TestSeries[]>([]);
    const [purchasedTestIds, setPurchasedTestIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedSubCategory, setSelectedSubCategory] = useState('All');
    const [enrollingId, setEnrollingId] = useState<string | null>(null);

    const fallbackTests = [
        {
            id: 'neet-ug-2026',
            name: 'NEET UG 2026 Series',
            examCategory: 'NEET',
            courseClass: 'Class 12',
            pricing: { type: 'paid', amount: 1299, currency: 'INR' },
            description: 'NEET UG ready series with NCERT-based practice, biology focus, and full syllabus mock tests.',
            features: [
                'NCERT-aligned theory coverage',
                'Biology-centric full tests',
                'Physics & Chemistry practice drills',
                'Performance analytics and review'
            ],
            testIds: [],
            createdBy: 'system',
            createdAt: { seconds: 0, nanoseconds: 0 } as any,
            updatedAt: { seconds: 0, nanoseconds: 0 } as any,
            status: 'published'
        },
        {
            id: 'jee-mains-2026',
            name: 'JEE Mains/Adv 2026 Series',
            examCategory: 'JEE',
            courseClass: 'Class 12',
            pricing: { type: 'paid', amount: 1499, currency: 'INR' },
            description: 'Advanced JEE preparation with full-length mock tests, chapter practice and ranking analytics.',
            features: [
                'NTA-style mock tests',
                'Chapter-wise problems',
                'Performance improvement insights',
                'Rank predictor reports'
            ],
            testIds: [],
            createdBy: 'system',
            createdAt: { seconds: 0, nanoseconds: 0 } as any,
            updatedAt: { seconds: 0, nanoseconds: 0 } as any,
            status: 'published'
        },
        {
            id: 'ssc-cgl-2026',
            name: 'SSC CGL 2026 Series',
            examCategory: 'SSC',
            courseClass: 'Class 12',
            pricing: { type: 'paid', amount: 999, currency: 'INR' },
            description: 'Prepare for SSC with full-length mocks, reasoning drills, and general awareness practice.',
            features: [
                'Quantitative Aptitude',
                'Reasoning & English',
                'General Awareness',
                'Full-length SSC Mocks'
            ],
            testIds: [],
            createdBy: 'system',
            createdAt: { seconds: 0, nanoseconds: 0 } as any,
            updatedAt: { seconds: 0, nanoseconds: 0 } as any,
            status: 'published'
        },
        {
            id: 'ssc-chsl-2026',
            name: 'SSC CHSL Crash Series',
            examCategory: 'SSC',
            courseClass: 'Class 12',
            pricing: { type: 'paid', amount: 799, currency: 'INR' },
            description: 'Fast-track SSC CHSL readiness with topic-wise practice and performance analytics.',
            features: [
                'Speed & Accuracy Drills',
                'General Awareness Boosters',
                'Reasoning Strategy Tests',
                'Score Improvement Insights'
            ],
            testIds: [],
            createdBy: 'system',
            createdAt: { seconds: 0, nanoseconds: 0 } as any,
            updatedAt: { seconds: 0, nanoseconds: 0 } as any,
            status: 'published'
        },
        {
            id: 'class-10-mcq-series',
            name: 'Class 10 MCQ Practice Series',
            examCategory: 'Class 10',
            courseClass: 'Class 10',
            pricing: { type: 'free', currency: 'INR' },
            description: 'Comprehensive MCQ practice for Class 10 Physics, Chemistry, and Mathematics with detailed explanations.',
            features: [
                'Physics, Chemistry & Maths MCQs',
                'Topic-wise Practice',
                'Detailed Solutions',
                'Progress Tracking'
            ],
            testIds: ['class10-physics-test', 'class10-chemistry-test', 'class10-maths-test'],
            createdBy: 'system',
            createdAt: { seconds: 0, nanoseconds: 0 } as any,
            updatedAt: { seconds: 0, nanoseconds: 0 } as any,
            status: 'published'
        }
    ] as TestSeries[];

    const getFallbackTests = () => {
        if (selectedCategory === 'SSC') {
            return fallbackTests.filter(item => item.examCategory === 'SSC');
        }

        if (selectedCategory === 'Class 10') {
            return fallbackTests.filter(item => item.courseClass === 'Class 10');
        }

        if (selectedCategory === 'Class 12') {
            if (selectedSubCategory === 'NEET') {
                return fallbackTests.filter(item => item.examCategory === 'NEET');
            }
            if (selectedSubCategory === 'JEE') {
                return fallbackTests.filter(item => item.examCategory === 'JEE');
            }
            return fallbackTests.filter(item => ['NEET', 'JEE'].includes(item.examCategory));
        }

        return [];
    };

    // Fetch Tests (Real Data)
    useEffect(() => {
        const fetchTests = async () => {
            try {
                // 1. First try fetching only published
                let data = await getAllTestSeries({ status: 'published' });
                
                // 2. If no published found, fetch all (for development/testing visibility)
                if (data.length === 0) {
                    console.warn("No published series found, fetching all series for visibility.");
                    data = await getAllTestSeries();
                }

                // 3. If still no data, use fallback tests
                if (data.length === 0) {
                    console.warn("No series found in database, using fallback data.");
                    data = fallbackTests;
                }

                console.log("Marketplace Data Loaded:", data);
                setTests(data);
            } catch (error) {
                console.error("Error fetching test series:", error);
                // Use fallback data on error
                setTests(fallbackTests);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTests();
    }, []);

    // Fetch User Purchases
    useEffect(() => {
        if (currentUser) {
            const purchasesRef = collection(db, 'users', currentUser.uid, 'purchases');
            const unsubscribePurchases = onSnapshot(purchasesRef, (snapshot) => {
                const ids = new Set(snapshot.docs.map(doc => doc.data().seriesId || doc.data().testId));
                setPurchasedTestIds(ids);
            });
            return () => unsubscribePurchases();
        }
    }, [currentUser]);

    const handleBuy = async (series: TestSeries) => {
        if (!currentUser) return;
        if (purchasedTestIds.has(series.id)) return;

        setEnrollingId(series.id);
        try {
            await marketplaceService.processPayment(currentUser.uid, {
                ...series,
                id: series.id,
                title: series.name,
                price: series.pricing?.type === 'paid' ? series.pricing.amount : 0,
                type: 'testSeries'
            });
            alert('Success! You are now enrolled.');
            setEnrollingId(null);
        } catch (error: any) {
            console.error("Enrollment failed", error);
            if (error.message !== "Payment cancelled by user") {
                alert('Failed: ' + error.message);
            }
            setEnrollingId(null);
        }
    };

    const getCourseClass = (item: TestSeries) => {
        const explicit = String((item as any).courseClass || (item as any).className || '').trim();
        if (explicit) return explicit;

        const name = String(item.name || '').toLowerCase();
        if (name.includes('class 10') || name.includes('class10')) return 'Class 10';
        if (name.includes('class 12') || name.includes('class12')) return 'Class 12';
        return '';
    };

    const getExamCategory = (item: TestSeries) => String(item.examCategory || '').trim();

    const filteredTests = tests.filter(test => {
        const seriesName = test.name || (test as any).title || '';
        const category = getExamCategory(test);
        const courseClass = getCourseClass(test);

        const matchesSearch = seriesName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            courseClass.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = (() => {
            if (selectedCategory === 'All') {
                return true;
            }

            if (selectedCategory === 'Class 10') {
                return courseClass.toLowerCase().includes('10');
            }

            if (selectedCategory === 'Class 12') {
                const isClass12 = courseClass.toLowerCase().includes('12');
                const isJeeNeet = ['jee', 'neet'].includes(category.toLowerCase());
                if (!isClass12 && !isJeeNeet) return false;
                if (selectedSubCategory === 'All') return true;
                return category.toLowerCase() === selectedSubCategory.toLowerCase();
            }

            if (selectedCategory === 'SSC') {
                return category.toLowerCase() === 'ssc';
            }

            return false;
        })();

        return matchesSearch && matchesCategory;
    });

    const fallbackForCurrentSelection = getFallbackTests();
    let displayTests = filteredTests;

    if (filteredTests.length === 0) {
        displayTests = fallbackForCurrentSelection;
    } else if (selectedCategory === 'Class 12' && selectedSubCategory === 'All') {
        const existingIds = new Set(filteredTests.map(test => test.id));
        const missingFallbacks = fallbackForCurrentSelection.filter((test) => !existingIds.has(test.id));
        displayTests = [...filteredTests, ...missingFallbacks];
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Test Series Market</h1>
                    <p className="text-slate-500 mt-1 font-medium">Hand-picked premium series for your success.</p>
                </div>
                <div className="flex flex-col gap-4 w-full lg:w-auto">
                    <div className="flex flex-wrap items-center gap-3">
                        {[
                            { label: 'All Categories', value: 'All' },
                            { label: 'Class 10', value: 'Class 10' },
                            { label: 'Class 12', value: 'Class 12' },
                            { label: 'SSC Exams', value: 'SSC' }
                        ].map((item) => (
                            <button
                                key={item.value}
                                onClick={() => {
                                    setSelectedCategory(item.value);
                                    setSelectedSubCategory('All');
                                }}
                                className={`px-5 py-3 rounded-md text-sm font-bold transition-all ${selectedCategory === item.value ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-500'}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {selectedCategory === 'Class 12' && (
                        <div className="flex flex-wrap items-center gap-3">
                            {[
                                { label: 'All Class 12', value: 'All' },
                                { label: 'NEET UG', value: 'NEET' },
                                { label: 'JEE Mains/Adv', value: 'JEE' }
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    onClick={() => setSelectedSubCategory(item.value)}
                                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${selectedSubCategory === item.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-500'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="relative flex-1 sm:w-80">
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Find your goal..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-500 transition-all font-semibold shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-teal-600" size={40} />
                </div>
            ) : displayTests.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    No test series found matching your search.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {displayTests.map((series) => {
                        const isOwned = purchasedTestIds.has(series.id);
                        const isBuying = enrollingId === series.id;
                        const isFree = series.pricing?.type === 'free' || !series.pricing?.amount || series.pricing.amount === 0;
                        const title = series.name;

                        // Build the custom action button
                        const actionButton = isOwned ? (
                            <button
                                disabled
                                className="w-full h-12 rounded-md bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-default"
                            >
                                <CheckCircle size={18} /> Enrolled & Active
                            </button>
                        ) : isBuying ? (
                            <button
                                disabled
                                className="w-full h-12 rounded-md bg-slate-800 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 cursor-wait"
                            >
                                <Loader2 className="animate-spin" size={18} />
                                {isFree ? 'Enrolling...' : 'Processing...'}
                            </button>
                        ) : (
                            <button
                                onClick={() => handleBuy(series)}
                                className="w-full h-12 rounded-md bg-slate-900 hover:bg-teal-600 text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                {isFree ? 'Enroll for Free' : `Access Now for ₹${series.pricing.amount}`}
                                <ArrowRight size={18} />
                            </button>
                        );

                        return (
                            <div key={series.id} className="relative">
                                <TestSeriesCard
                                    title={title}
                                    description={series.description}
                                    isNew={!!(series as any).isNew}
                                    features={(series as any).features || []}
                                    originalPrice={series.pricing?.type === 'paid' ? `${(series.pricing.amount || 0) * 1.5}` : '0'}
                                    price={series.pricing?.type === 'paid' ? `${series.pricing.amount}` : 'Free'}
                                    colorTheme="orange"
                                    examCategory={series.examCategory}
                                    testCount={(series as any).testIds?.length || 0}
                                    actions={actionButton}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
export default StudentMarketPage;


