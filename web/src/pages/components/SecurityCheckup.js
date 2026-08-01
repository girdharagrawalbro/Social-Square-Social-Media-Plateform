import React from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';

const SecurityCheckup = ({ setActiveTab }) => {
    const user = useAuthStore(s => s.user);

    // Checks
    const isEmailVerified = user?.isEmailVerified;
    const has2FA = user?.twoFactorEnabled;
    const hasPassword = !!user?.password; // Assuming they have a password if they don't use 3rd party
    // Simple logic to consider OAuth as secure since it relies on third party
    const hasStrongAuth = hasPassword ? true : (user?.googleId || user?.githubId);

    const checkupItems = [
        {
            title: 'Email Address Verified',
            desc: 'A verified email ensures you can recover your account if you lose access.',
            passed: isEmailVerified,
            actionLabel: 'Check Email Settings',
            actionTab: 'account'
        },
        {
            title: 'Two-Factor Authentication',
            desc: '2FA requires a code sent to your email when logging in from a new device.',
            passed: has2FA,
            actionLabel: 'Enable 2FA',
            actionTab: 'password_security'
        },
        {
            title: 'Strong Authentication',
            desc: 'Your account uses a password or secure third-party login.',
            passed: hasStrongAuth,
            actionLabel: 'Change Password',
            actionTab: 'password_security'
        },
        {
            title: 'Active Sessions',
            desc: 'Review where you are currently logged in to ensure no unauthorized access.',
            passed: true, // It\'s a manual review item
            actionLabel: 'Review Sessions',
            actionTab: 'sessions'
        }
    ];

    const passedCount = checkupItems.filter(item => item.passed).length;
    const totalCount = checkupItems.length;
    const allPassed = passedCount === totalCount;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 m-0 pb-2 border-b border-gray-100">Security Checkup</h2>
            
            <div className={`p-4 rounded-xl border ${allPassed ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                <div className="flex items-start gap-3">
                    <i className={`pi ${allPassed ? 'pi-shield text-green-500' : 'pi-exclamation-triangle text-orange-500'} text-2xl mt-1`} />
                    <div>
                        <h3 className={`text-sm font-bold m-0 ${allPassed ? 'text-green-800' : 'text-orange-800'}`}>
                            {allPassed ? 'Your account is secure' : 'Security improvements recommended'}
                        </h3>
                        <p className={`text-xs mt-1 mb-0 ${allPassed ? 'text-green-600' : 'text-orange-600'}`}>
                            You have completed {passedCount} of {totalCount} recommended security steps.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {checkupItems.map((item, idx) => (
                    <div key={idx} className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 items-start">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.passed ? 'bg-green-100' : 'bg-orange-100'}`}>
                            <i className={`pi ${item.passed ? 'pi-check text-green-600' : 'pi-exclamation-triangle text-orange-600'} text-sm`} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900 m-0">{item.title}</h4>
                            <p className="text-xs text-gray-500 mt-1 mb-3">{item.desc}</p>
                            
                            {!item.passed || item.actionTab === 'sessions' ? (
                                <button 
                                    onClick={() => setActiveTab(item.actionTab)}
                                    className="text-xs font-semibold text-[#4f46e5] hover:text-indigo-700 bg-transparent border-0 cursor-pointer p-0"
                                >
                                    {item.actionLabel} &rarr;
                                </button>
                            ) : (
                                <span className="text-xs font-semibold text-green-600">Completed</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SecurityCheckup;
