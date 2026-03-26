import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { RadioButton } from 'primereact/radiobutton';
import { Button } from 'primereact/button';

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
        <div className="flex justify-end gap-2 px-1 pb-1">
            <Button label="Cancel" icon="pi pi-times" onClick={() => { onHide(); setSelectedReason(null); }} className="p-button-text p-button-sm text-gray-600" />
            <Button label="Submit" icon="pi pi-check" onClick={handleSubmit} disabled={!selectedReason || loading} loading={loading} className="p-button-sm bg-red-500 border-red-500 hover:bg-red-600" />
        </div>
    );

    return (
        <Dialog 
            header="Report Post" 
            visible={visible} 
            onHide={() => { onHide(); setSelectedReason(null); }} 
            footer={footer}
            style={{ width: '300px' }}
            draggable={false}
            resizable={false}
            className="rounded-xl overflow-hidden font-sans"
        >
            <div className="flex flex-col gap-3 py-2">
                <p className="text-sm text-gray-500 m-0 mb-2 font-medium">Why are you reporting this post?</p>
                {REASONS.map((reason) => (
                    <div key={reason.value} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition" onClick={() => setSelectedReason(reason.value)}>
                        <RadioButton 
                            inputId={reason.value} 
                            name="reportReason" 
                            value={reason.value} 
                            onChange={(e) => setSelectedReason(e.value)} 
                            checked={selectedReason === reason.value} 
                        />
                        <label htmlFor={reason.value} className="text-sm cursor-pointer font-medium text-gray-700">{reason.label}</label>
                    </div>
                ))}
            </div>
        </Dialog>
    );
};

export default ReportDialog;
