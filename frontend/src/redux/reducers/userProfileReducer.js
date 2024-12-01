import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isVisible: false,
};

export const userProfileSlice = createSlice({
  name: 'userProfile',
  initialState,
  reducers: {
    showUserProfile: (state) => {
      state.isVisible = true;
    },
    hideUserProfile: (state) => { 
      state.isVisible = false;
    },
  },
});

export const { showUserProfile, hideUserProfile } = userProfileSlice.actions;

export default userProfileSlice.reducer;