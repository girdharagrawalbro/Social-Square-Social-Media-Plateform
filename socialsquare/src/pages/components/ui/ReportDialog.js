import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { RadioButton } from 'primereact/radiobutton';

const REASONS = [
    { label: 'Spam', value: 'spam' },
    { label: 'Harassment', value: 'harassment' },
    { label: 'Hate Speech', value: 'hate_speech' },
    { label: 'Misinformation', value: 'misinformation' },
    { label: 'Nudity', value: 'nudity' },
    { label: 'Violence', value: 'violence' },
    { label: 'Other', value: 'other' }
];

const ReportDialog = ({ visible, onHide, onSubmit, loading }) => {
    const [selectedReason, setSelectedReason] = useState(null);

    const handleSubmit = () => {
        if (selectedReason) {
            onSubmit(selectedReason);
            setSelectedReason(null);
        }
    };

    const footer = (
        <div className="flex justify-end gap-2 pt-3 ">
            <button onClick={() => { onHide(); setSelectedReason(null); }} className="px-4 py-2 border-0 bg-transparent text-[var(--text-sub)] font-semibold text-sm cursor-pointer hover:bg-[var(--surface-2)] rounded-lg transition">Cancel</button>
            <button onClick={handleSubmit} disabled={!selectedReason || loading} className="px-4 py-2 bg-red-500 text-white border-0 rounded-lg font-semibold text-sm cursor-pointer hover:bg-red-600 transition disabled:opacity-50">
                {loading ? 'Submitting...' : 'Submit Report'}
            </button>
        </div>
    );

    return (
        <Dialog
            header="Why are you reporting this post?"
            visible={visible}
            onHide={() => { onHide(); setSelectedReason(null); }}
            footer={footer}
            style={{ width: '500px' }}
            draggable={false}
            resizable={false}
            className="rounded-xl overflow-hidden font-sans"
        >
            <div className="flex flex-col gap-3 py-2 px-3">
                {REASONS.map((reason) => (
                    <div key={reason.value} className="flex items-center gap-3 cursor-pointer p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-1)] rounded-xl border border-[var(--border-color)] transition" onClick={() => setSelectedReason(reason.value)}>
                        <RadioButton
                            inputId={reason.value}
                            name="reportReason"
                            value={reason.value}
                            onChange={(e) => setSelectedReason(e.value)}
                            checked={selectedReason === reason.value}
                        />
                        <label htmlFor={reason.value} className="text-sm cursor-pointer font-bold text-[var(--text-main)] flex-grow">{reason.label}</label>
                    </div>
                ))}
            </div>
        </Dialog>
    );
};

export default ReportDialog;
