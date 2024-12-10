import React, { createContext, useState, useEffect } from "react";
import axios from "axios";

export const PostContext = createContext();


export const PostProvider = ({ children }) => {

  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);

  // Fetch Posts
  const fetchPosts = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/post");
      setPosts(response.data);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  };

  // Fetch Categories
  const fetchCategories = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/post/categories");
      setCategories(response.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };



  return (
    <PostContext.Provider value={{ posts, categories, fetchPosts, fetchCategories }}>
      {children}
    </PostContext.Provider>
  );
};

export default PostProvider;