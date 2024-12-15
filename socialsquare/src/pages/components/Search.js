import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from 'react-redux';
import { fetchCategories } from "../../store/slices/postsSlice";
import { search } from "../../store/slices/userSlice";
import { Dialog } from 'primereact/dialog';
import UserProfile from './UserProfile';

const Search = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const dispatch = useDispatch();
    const { categories } = useSelector((state) => state.posts);
    const { searchResults, loading, error } = useSelector((state) => state.users);
    const [isVisible, setVisible] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);

    useEffect(() => {
        dispatch(fetchCategories());
    }, [dispatch]);

    const handleSearch = (e) => {
        const term = e.target.value.trim();
        setSearchTerm(term);

        if (term) {
            dispatch(search(term));
        }
    };

    const handleUserClick = (userId) => {
        setSelectedUserId(userId);
        setVisible(true);
    };

    return (
        <>
            {/* Search Input */}
            <div className="explore d-flex gap-2">
                <input
                    placeholder="Search..."
                    className="border p-2 rounded w-100"
                    type="text"
                    value={searchTerm}
                    onChange={handleSearch}
                />
                <button className="theme-bg px-2" aria-label="Search">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
                        <path d="M17.5 17.5L22 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M20 11C20 6.02944 15.9706 2 11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C15.9706 20 20 15.9706 20 11Z" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                </button>
            </div>

            {/* Categories */}
            <div className="suggestion d-flex gap-2 mt-3">
                {categories.length > 0 ? (
                    categories.map((category, index) => (
                        <button
                            key={index}
                            className="theme-bg"
                            onClick={() => dispatch(search(category.category))}
                        >
                            #{category.category}
                        </button>
                    ))
                ) : (
                    <p>No categories available.</p>
                )}
            </div>

            {/* Search Results */}
            <div className="suggestion my-2">
                {loading.search ? (
                    <p>Searching...</p>
                ) : (
                    <>
                        {searchResults.users.length > 0 && (
                            <div>
                                <h5>Users</h5>
                                <div className="d-flex gap-2 flex-wrap">
                                    {searchResults.users.map((user) => (
                                        <button
                                            key={user._id}
                                            onClick={() => handleUserClick(user._id)}
                                            className="btn btn-outline-primary"
                                        >
                                            {user.fullname}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* {searchResults.posts.length > 0 && (
                            <div className="mt-2">
                                <h5>Posts</h5>
                                <div className="d-flex gap-2 flex-wrap">
                                    {searchResults.posts.map((post) => (
                                        <button key={post._id} className="btn btn-outline-primary">
                                            #{post.category} - {post.caption}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )} */}

                        {searchResults.users.length === 0 &&
                            searchResults.posts.length === 0 &&
                            searchTerm && <p>No results found for "{searchTerm}".</p>}
                    </>
                )}
            </div>

            {/* User Profile Dialog */}
            <Dialog
                header="User Profile"
                visible={isVisible}
                style={{ width: '25vw' }}
                onHide={() => setVisible(false)}
            >
                <UserProfile id={selectedUserId} />
            </Dialog>
        </>
    );
};

export default Search;
