import React from 'react'
import Profile from './components/Profile'
import Feed from './components/Feed'
import FollowingList from './components/FollowingList'

const Home = () => {
    return (
        <>
            <FollowingList />
            <Feed />
            <Profile />
        </>
    )
}

export default Home