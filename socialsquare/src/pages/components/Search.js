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
    const { searchResults, loading } = useSelector((state) => state.users);
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
            <div className="explore relative w-full flex gap-2 items-center">
                <input
                    placeholder="Search for users, posts, or categories..."
                    className="py-2 px-4 rounded-full bg-gray-100 w-full"
                    type="text"
                    value={searchTerm}
                    onChange={handleSearch}
                />
               

                {searchTerm && (
                    <div className="absolute left-0 right-0 t-54 bg-white shadow-md rounded max-h-96 overflow-auto z-50 p-3">
                        {/* Categories */}
                        <div className="suggestion flex gap-2 mt-1 flex-wrap">
                            {categories.length > 0 ? (
                                categories.map((category, index) => (
                                    <button
                                        key={index}
                                        className="btn bg-[#808bf5] px-3 py-1 rounded-full text-white"
                                        onClick={() => dispatch(search(category.category))}
                                    >
                                        # {category.category}
                                    </button>
                                ))
                            ) : (
                                <p>No categories available.</p>
                            )}
                        </div>

                        {/* Search Results */}
                        <div className="suggestion my-2">
                            {loading.search ? (
                                <p className="mt-2">Searching...</p>
                            ) : (
                                <>
                                    {searchResults.users.length > 0 && (
                                        <div>
                                            <div className="flex gap-2 flex-wrap">
                                                {searchResults.users.map((user) => (
                                                    <button
                                                        key={user._id}
                                                        onClick={() => handleUserClick(user._id)}
                                                        className="btn btn-outline-primary dropdown-item border px-3 py-2 rounded-full"
                                                    >
                                                        {user.fullname}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {searchResults.posts.length > 0 && (
                                        <div className="mt-2">
                                            <div className="flex gap-2 flex-wrap">
                                                {searchResults.posts.map((post) => (
                                                    <button key={post._id} className="btn btn-outline-primary dropdown-item border">
                                                        #{post.category} - {post.caption}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {searchResults.users.length === 0 &&
                                        searchResults.posts.length === 0 &&
                                        searchTerm && <p>No results found for "{searchTerm}".</p>}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>


            {/* User Profile Dialog */}
            <Dialog
                header="User Profile"
                visible={isVisible}
                style={{ width: '340px', height: "400px" }}
                onHide={() => setVisible(false)}
            >
                <UserProfile id={selectedUserId} />
            </Dialog>
        </>
    );
};

export default Search;
