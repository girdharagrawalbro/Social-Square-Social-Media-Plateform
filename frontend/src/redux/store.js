import { configureStore } from '@reduxjs/toolkit';
import userProfileReducer from './reducers/userProfileReducer';

export const store = configureStore({
  reducer: {
    userProfile: userProfileReducer,
  },
});