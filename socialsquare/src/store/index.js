import { configureStore } from '@reduxjs/toolkit';
import visibilityReducer from './slices/visibilitySlice';
import userReducer from './slices/userSlice';
import postReducer from './slices/postsSlice';

export const store = configureStore({
  reducer: {
    visibility: visibilityReducer,
    users:  userReducer,
    posts: postReducer
  },
});

