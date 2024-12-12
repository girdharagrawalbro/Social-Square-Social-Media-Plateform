import React, { useState, useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import { useDispatch, useSelector } from "react-redux";
import { updateUser } from '../../store/slices/userSlice';
const EditProfile = ({ users, onSubmit, closeSidebar }) => {
    const dispatch = useDispatch();

    const [formData, setFormData] = useState({
        fullname: "",
        email: "",
        profile_picture: "",
        bio: "",
    });

    // Load user data into the form when the component mounts or users changes
    useEffect(() => {
        if (users) {
            setFormData({
                fullname: users.fullname || "",
                email: users.email || "",
                profile_picture: users.profile_picture || "",
                bio: users.bio || "",
            });
        }
    }, [users]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const userData = {
        ...formData,
        userId: users._id
    }
    const handleSubmit = async (e) => {
        e.preventDefault();
        dispatch(updateUser(userData));
        onSubmit();
        closeSidebar();
    };



    return (
        <form onSubmit={handleSubmit} className=" w-100 h-100">
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
