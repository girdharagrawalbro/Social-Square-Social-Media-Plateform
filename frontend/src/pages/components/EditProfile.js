import React, { useState, useEffect } from 'react';

const EditProfile = ({ userData, onSubmit }) => {
    const [formData, setFormData] = useState({
        fullname: "",
        email: "",
        profile_picture: "",
        bio: "",
    });

    // Load user data into the form when the component mounts or userData changes
    useEffect(() => {
        if (userData) {
            setFormData({
                fullname: userData.fullname || "",
                email: userData.email || "",
                profile_picture: userData.profile_picture || "",
                bio: userData.bio || "",
            });
        }
    }, [userData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:5000/api/auth/update-profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userData._id, // Pass userId from userData
                    ...formData, // Spread formData containing fullname, email, etc.
                }),
            });

            if (response.ok) {
                const data = await response.json();
                alert("Profile updated successfully!");
                onSubmit(data);
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (err) {
            console.error("Failed to update profile:", err);
            alert("An error occurred. Please try again.");
        }
    };



    return (
        <form onSubmit={handleSubmit} className=" editform p-4 bordershadow rounded w-100 h-100">
            <h4 className="mb-4 text-center">Update your Profile</h4>

            <div className="mb-3">
                <label htmlFor="fullname" className="form-label">Full Name</label>
                <input
                    type="text"
                    id="fullname"
                    name="fullname"
                    value={formData.fullname}
                    onChange={handleChange}
                    className="form-control"
                    required
                />
            </div>

            <div className="mb-3">
                <label htmlFor="email" className="form-label">Email</label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-control"
                    required
                />
            </div>



            <div className="mb-3">
                <label htmlFor="profile_picture" className="form-label">Profile Picture URL</label>
                <input
                    type="url"
                    id="profile_picture"
                    name="profile_picture"
                    value={formData.profile_picture}
                    onChange={handleChange}
                    className="form-control"
                />
            </div>

            <div className="mb-3">
                <label htmlFor="bio" className="form-label">Bio</label>
                <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="form-control"
                />
            </div>


            <button type="submit" className="theme-bg py-1 px-2">Save Changes</button>
        </form>
    );
};

export default EditProfile;
