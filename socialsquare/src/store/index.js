import { configureStore } from '@reduxjs/toolkit';
import visibilityReducer1 from './slices/visibilitySlice';
import visibilityReducer2 from './slices/visibilitySlice2';
import visibilityReducer3 from './slices/visibilitySlice3';
import userReducer from './slices/userSlice';
import postReducer from './slices/postsSlice';

export const store = configureStore({
  reducer: {
    visibility: visibilityReducer1,
    visibility2: visibilityReducer2,
    visibility3: visibilityReducer3,
    users:  userReducer,
    posts: postReducer
  },
});
