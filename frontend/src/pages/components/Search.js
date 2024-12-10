import React, { useContext, useEffect, useState } from "react";



const Search = () => {
    const [searchTerm, setSearchTerm] = useState(""); // To track the search input
    const [users, setUsers] = useState([]); // To store the search results for users
    const [searchposts, setPosts] = useState([]); // To store the search results for posts
    const [notfound, setNotfound] = useState(false);

    
    const handleSearch = async (e) => {

        const term = e.target.value;
        setSearchTerm(term);
    
        if (term.trim()) {
            try {
                const response = await fetch(`http://localhost:5000/api/auth/search`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ query: term }),
                });
    
                if (response.ok) {
                    const data = await response.json();
                    if (data.type === "user") {
                        setUsers(data.results); // Update user suggestions
                    } else if (data.type === "post") {
                        setPosts(data.results); // Update post suggestions
                    }
                    else if (data.type === "no") {
                        setNotfound(true);
                    }
                } else {
                    console.error("Error fetching search results");
                }
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("API Error:", errorData.message || "Unknown error");
                    alert(`Failed: ${errorData.message || "Try again later."}`);
                }
    
            } catch (error) {
                console.error("Error during search:", error);
            }
        } else {
            setUsers([]);
            setPosts([]);
            setNotfound(false)
        }
    };
    return (
        <> {/* Explore Section */}
            <div className="explore d-flex gap-2">
                <input
                    placeholder="# Explore..."
                    className="border p-2 rounded w-100"
                    type="text"
                    value={searchTerm}
                    onChange={handleSearch}
                />
                <button className="theme-bg px-2" aria-label="Search">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        fill="none"
                    >
                        <path
                            d="M17.5 17.5L22 22"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path
                            d="M20 11C20 6.02944 15.9706 2 11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C15.9706 20 20 15.9706 20 11Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            </div>
            {searchposts.length > 0 && (
          <div className="mt-2">
            <h5>Posts</h5>
            <div className=" d-flex gap-2 flex-column">

              {searchposts.map((post) => (
                <button key={post._id} className="btn btn-outline-primary">
                  #{post.category} - {post.caption}
                </button>
              ))}
            </div>
          </div>
        )}

        {notfound && (
          <p>No results found for "{searchTerm}"</p>
        )
        }
 </>
    )
}

export default Search