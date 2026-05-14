import type { ReactNode } from 'react';
import { Sparkles, ScrollText, Users, CheckCircle, Award, Zap, ArrowRight } from 'lucide-react';

interface TestSeriesProps {
    title: string;
    description?: string;
    isNew?: boolean;
    features?: string[];
    originalPrice: string | number;
    price: string | number;
    colorTheme?: 'blue' | 'green' | 'orange';
    onExplore?: () => void;
    actions?: ReactNode; // For Admin side
    examCategory?: string;
    testCount?: number;
}

const TestSeriesCard = ({ 
    title, 
    description,
    isNew, 
    features = [], 
    originalPrice, 
    price, 
    onExplore,
    actions,
    examCategory,
    testCount
}: TestSeriesProps) => {

    const themeConfig = {
        blue: {
            bg: 'bg-teal-50/50',
            border: 'border-teal-100',
            text: 'text-teal-600',
            glow: 'shadow-teal-500/20',
            gradient: 'from-teal-600 to-indigo-600',
            iconBg: 'bg-teal-100/50'
        },
        green: {
            bg: 'bg-emerald-50/50',
            border: 'border-emerald-100',
            text: 'text-emerald-600',
            glow: 'shadow-emerald-500/20',
            gradient: 'from-emerald-600 to-teal-600',
            iconBg: 'bg-emerald-100/50'
        },
        amber: {
            bg: 'bg-amber-50/70',
            border: 'border-amber-100',
            text: 'text-amber-600',
            glow: 'shadow-amber-500/20',
            gradient: 'from-amber-500 to-orange-500',
            iconBg: 'bg-amber-100/50'
        },
        orange: {
            bg: 'bg-teal-50/50',
            border: 'border-teal-100',
            text: 'text-teal-600',
            glow: 'shadow-teal-500/20',
            gradient: 'from-teal-600 to-teal-600',
            iconBg: 'bg-teal-100/50'
        }
    };

    const normalizedCategory = String(examCategory || '').trim().toUpperCase();
    const themeKey = normalizedCategory.includes('NEET')
        ? 'green'
        : normalizedCategory.includes('JEE')
            ? 'blue'
            : normalizedCategory.includes('SSC')
                ? 'amber'
                : 'orange';

    const currentTheme = themeConfig[themeKey];

    const defaultFeatures = normalizedCategory.includes('SSC')
        ? ['Quantitative Aptitude', 'Reasoning & English', 'General Awareness', 'Speed & Accuracy Drills']
        : normalizedCategory.includes('JEE')
            ? ['Full syllabus coverage', 'NTA-style mock tests', 'Chapter-wise practice', 'Rank predictor']
            : normalizedCategory.includes('NEET')
                ? ['NCERT-aligned practice', 'Biology-centric tests', 'Detailed video solutions', 'Performance analytics']
                : ['Detailed Performance Analytics', 'All India Ranking (AIR)', 'Step-by-step Video Solutions'];

    const renderedFeatures = (features.length > 0 ? features : defaultFeatures).slice(0, 3);

    return (
        <div 
            className="group relative h-full flex flex-col bg-white rounded-md border border-slate-200 hover:border-teal-500 transition-all duration-300"
        >
            {/* Top Pattern Overlay */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-transparent to-slate-100/50 rounded-bl-[100px] pointer-events-none" />
            
            {/* Main Content Area */}
            <div className="p-7 md:p-8 flex-1 flex flex-col relative z-10">
                {/* Header: Category & Badge */}
                <div className="flex justify-between items-center mb-8">
                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${currentTheme.bg} ${currentTheme.border} ${currentTheme.text} text-xs font-bold uppercase tracking-widest`}>
                        {examCategory || 'Academic'}
                    </div>
                    
                    {isNew && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-md text-[10px] font-bold uppercase tracking-widest">
                            <Sparkles size={12} className="text-teal-400" />
                            <span>New</span>
                        </div>
                    )}
                </div>

                {/* Title & Description */}
                <div className="mb-8">
                    <h3 className="text-2xl font-bold text-slate-900 leading-tight tracking-tight min-h-[3.3rem]">
                        {title}
                    </h3>
                    <p className="mt-4 text-sm font-medium text-slate-500 leading-relaxed line-clamp-2 italic">
                        {description || "Premium curated test series designed by experts to help you master every concept."}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 md:gap-4 mb-8">
                    <div className="bg-slate-50 rounded-md p-4 border border-slate-100 transition-all duration-300">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-md ${currentTheme.iconBg} ${currentTheme.text}`}>
                                <ScrollText size={20} />
                            </div>
                            <div>
                                <div className="text-lg font-bold text-slate-900">{testCount || 15}+</div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-tight">Full Tests</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 rounded-md p-4 border border-slate-100 transition-all duration-300">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-teal-50 text-teal-600">
                                <Users size={20} />
                            </div>
                            <div>
                                <div className="text-lg font-bold text-slate-900">12k+</div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-tight">Enrolled</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features */}
                <div className="space-y-3.5 mb-8">
                    {renderedFeatures.map((feature, i) => (
                        <div key={i} className="flex items-center gap-3 group/item">
                            <div className={`shrink-0 w-5 h-5 rounded-lg ${currentTheme.bg} ${currentTheme.text} flex items-center justify-center group-hover/item:scale-110 transition-transform`}>
                                <CheckCircle size={14} strokeWidth={3} />
                            </div>
                            <span className="text-xs font-bold text-slate-700 tracking-tight">{feature}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-auto pt-6 md:pt-8 border-t border-slate-100 flex items-center justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <Award size={12} className="text-teal-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate">Verified Content</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
                                {price === 'Free' || price === '0' || !price ? 'FREE' : `₹${price}`}
                            </span>
                            {price && price !== 'Free' && price !== '0' && (
                                <span className="text-slate-300 line-through text-sm font-bold">₹{originalPrice}</span>
                            )}
                        </div>
                    </div>
                    
                    <div className={`shrink-0 w-12 h-12 rounded-md ${currentTheme.bg} flex items-center justify-center ${currentTheme.text}`}>
                        <Zap size={24} className="md:w-7 md:h-7" />
                    </div>
                </div>
            </div>

            {/* Action Button Section */}
            <div className="px-7 md:px-8 pb-8 pt-2">
                {actions ? (
                    <div className="relative z-10">
                        {actions}
                    </div>
                ) : (
                    <button
                        onClick={onExplore}
                        className="w-full h-12 rounded-md bg-slate-900 hover:bg-teal-600 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                        Access Series
                        <ArrowRight size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default TestSeriesCard;
