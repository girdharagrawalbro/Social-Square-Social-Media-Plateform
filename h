Module not found: Error: Can't resolve '../utils/fingerprint' in 'D:\new\Social-Square-Social-Media-Plateform\socialsquare\src\store\zustand'

[eslint]
src\App.js
  Line 10:24:  'api' is defined but never used
                                              no-unused-vars
  Line 55:8:   React Hook useEffect has a missing dependency: 'initAuth'. Either include it or remove the dependency array        react-hooks/exhaustive-deps
  Line 67:8:   React Hook useEffect has a missing dependency: 'setOnlineUsers'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

src\hooks\queries\useConversationQueries.js
  Line 1:49:    'useInfiniteQuery' is defined but never used  no-unused-vars        
  Line 140:11:  'qc' is assigned a value but never used       no-unused-vars        

src\hooks\queries\usePostQueries.js
  Line 7:7:     'api' is assigned a value but never used  no-unused-vars
  Line 167:11:  'qc' is assigned a value but never used   no-unused-vars

src\hooks\useFeedSocket.js
  Line 112:8:  React Hook useEffect has missing dependencies: 'addSocketPost', 'removeSocketPost', and 'syncLike'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

src\pages\ActiveSessions.js
  Line 44:6:  React Hook useEffect has missing dependencies: 'fetchSessions' and 'fetchUser'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

src\pages\AdminDashboard.js
  Line 139:8:   React Hook useEffect has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 205:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 306:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 376:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 439:11:  The 'userLoading' object makes the dependencies of useEffect Hook (at line 458) change on every render. To fix this, wrap the initialization of 'userLoading' in its own useMemo() Hook  react-hooks/exhaustive-deps
  Line 449:8:   React Hook useEffect has a missing dependency: 'fetchUser'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps

src\pages\Home.js
  Line 36:8:  React Hook useEffect has a missing dependency: 'initAuth'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
  Line 43:8:  React Hook useEffect has a missing dependency: 'navigate'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

src\pages\Login.js
  Line 14:45:  'authLoading' is assigned a value but never used  no-unused-vars     

src\pages\PostDetail.js
  Line 139:8:   React Hook useEffect has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 205:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 306:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 376:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 439:11:  The 'userLoading' object makes the dependencies of useEffect Hook (at line 458) change on every render. To fix this, wrap the initialization of 'userLoading' in its own useMemo() Hook  react-hooks/exhaustive-deps
  Line 449:8:   React Hook useEffect has a missing dependency: 'fetchUser'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps

src\pages\components\Bg.js
  Line 2:8:  'Authnav' is defined but never used  no-unused-vars

src\pages\components\ChatPanel.js
  Line 272:8:  React Hook useEffect has a missing dependency: 'store'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

src\pages\components\Chatbot.js
  Line 138:41:  Function declared in a loop contains unsafe references to variable(s) 'accumulated'  no-loop-func

src\pages\components\Conversations.js
  Line 39:8:  React Hook useEffect has missing dependencies: 'incrementUnread', 'refetch', and 'setOnlineUsers'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

src\pages\components\Explore.js
  Line 3:25:    'useTrending' is defined but never used
                                        no-unused-vars
  Line 131:11:  'loggeduser' is assigned a value but never used
                                        no-unused-vars
  Line 152:12:  'loadingCategoryPosts' is assigned a value but never used
                                        no-unused-vars
  Line 167:29:  React Hook useCallback received a function whose dependencies are unknown. Pass an inline function instead  react-hooks/exhaustive-deps

src\pages\components\Feed.js
  Line 1:36:   'useCallback' is defined but never used
                                         no-unused-vars
  Line 193:8:  React Hook useEffect has a missing dependency: 'feedQuery'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

src\pages\components\MoodFeedToggle.js
  Line 3:10:  'useMoodFeed' is defined but never used  no-unused-vars

src\pages\components\Newpost.js
  Line 158:8:  React Hook useEffect has a missing dependency: 'searchCollaborator'. 
Either include it or remove the dependency array  react-hooks/exhaustive-deps       

src\pages\components\Profile.js
  Line 1:17:   'useEffect' is defined but never used         no-unused-vars
  Line 57:11:  'loading' is assigned a value but never used  no-unused-vars

src\pages\components\Search.js
  Line 51:29:  React Hook useCallback received a function whose dependencies are unknown. Pass an inline function instead  react-hooks/exhaustive-deps

src\pages\components\Stories.js
  Line 36:8:    React Hook useEffect has missing dependencies: 'DURATION', 'goNext', 'loggeduser._id', and 'story'. Either include them or remove the dependency array  
react-hooks/exhaustive-deps
  Line 201:42:  React Hook useEffect has a missing dependency: 'fetchStories'. Either include it or remove the dependency array
react-hooks/exhaustive-deps

src\store\zustand\useAuthStore.js
  Line 185:23:  'user' is assigned a value but never used  no-unused-vars

Search for the keywords to learn more about each warning.
To ignore, add // eslint-disable-next-line to the line before.

WARNING in ./src/store/zustand/useAuthStore.js 113:16-46
Module not found: Error: Can't resolve '../utils/fingerprint' in 'D:\new\Social-Square-Social-Media-Plateform\socialsquare\src\store\zustand'

WARNING in [eslint]
src\App.js
  Line 10:24:  'api' is defined but never used
                                              no-unused-vars
  Line 55:8:   React Hook useEffect has a missing dependency: 'initAuth'. Either include it or remove the dependency array        react-hooks/exhaustive-deps
  Line 67:8:   React Hook useEffect has a missing dependency: 'setOnlineUsers'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

src\hooks\queries\useConversationQueries.js
  Line 1:49:    'useInfiniteQuery' is defined but never used  no-unused-vars        
  Line 140:11:  'qc' is assigned a value but never used       no-unused-vars        

src\hooks\queries\usePostQueries.js
  Line 7:7:     'api' is assigned a value but never used  no-unused-vars
  Line 167:11:  'qc' is assigned a value but never used   no-unused-vars

src\hooks\useFeedSocket.js
  Line 112:8:  React Hook useEffect has missing dependencies: 'addSocketPost', 'removeSocketPost', and 'syncLike'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

src\pages\ActiveSessions.js
  Line 44:6:  React Hook useEffect has missing dependencies: 'fetchSessions' and 'fetchUser'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

src\pages\AdminDashboard.js
  Line 139:8:   React Hook useEffect has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 205:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 306:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 376:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 439:11:  The 'userLoading' object makes the dependencies of useEffect Hook (at line 458) change on every render. To fix this, wrap the initialization of 'userLoading' in its own useMemo() Hook  react-hooks/exhaustive-deps
  Line 449:8:   React Hook useEffect has a missing dependency: 'fetchUser'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps

src\pages\Home.js
  Line 36:8:  React Hook useEffect has a missing dependency: 'initAuth'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
  Line 43:8:  React Hook useEffect has a missing dependency: 'navigate'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

src\pages\Login.js
  Line 14:45:  'authLoading' is assigned a value but never used  no-unused-vars     

src\pages\PostDetail.js
  Line 139:8:   React Hook useEffect has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 205:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 306:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 376:8:   React Hook useCallback has a missing dependency: 'headers'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps
  Line 439:11:  The 'userLoading' object makes the dependencies of useEffect Hook (at line 458) change on every render. To fix this, wrap the initialization of 'userLoading' in its own useMemo() Hook  react-hooks/exhaustive-deps
  Line 449:8:   React Hook useEffect has a missing dependency: 'fetchUser'. Either include it or remove the dependency array
                                 react-hooks/exhaustive-deps

src\pages\components\Bg.js
  Line 2:8:  'Authnav' is defined but never used  no-unused-vars

src\pages\components\ChatPanel.js
  Line 272:8:  React Hook useEffect has a missing dependency: 'store'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

src\pages\components\Chatbot.js
  Line 138:41:  Function declared in a loop contains unsafe references to variable(s) 'accumulated'  no-loop-func

src\pages\components\Conversations.js
  Line 39:8:  React Hook useEffect has missing dependencies: 'incrementUnread', 'refetch', and 'setOnlineUsers'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

src\pages\components\Explore.js
  Line 3:25:    'useTrending' is defined but never used
                                        no-unused-vars
  Line 131:11:  'loggeduser' is assigned a value but never used
                                        no-unused-vars
  Line 152:12:  'loadingCategoryPosts' is assigned a value but never used
                                        no-unused-vars
  Line 167:29:  React Hook useCallback received a function whose dependencies are unknown. Pass an inline function instead  react-hooks/exhaustive-deps

src\pages\components\Feed.js
  Line 1:36:   'useCallback' is defined but never used
                                         no-unused-vars
  Line 193:8:  React Hook useEffect has a missing dependency: 'feedQuery'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

src\pages\components\MoodFeedToggle.js
  Line 3:10:  'useMoodFeed' is defined but never used  no-unused-vars

src\pages\components\Newpost.js
  Line 158:8:  React Hook useEffect has a missing dependency: 'searchCollaborator'. 
Either include it or remove the dependency array  react-hooks/exhaustive-deps       

src\pages\components\Profile.js
  Line 1:17:   'useEffect' is defined but never used         no-unused-vars
  Line 57:11:  'loading' is assigned a value but never used  no-unused-vars

src\pages\components\Search.js
  Line 51:29:  React Hook useCallback received a function whose dependencies are unknown. Pass an inline function instead  react-hooks/exhaustive-deps

src\pages\components\Stories.js
  Line 36:8:    React Hook useEffect has missing dependencies: 'DURATION', 'goNext', 'loggeduser._id', and 'story'. Either include them or remove the dependency array  
react-hooks/exhaustive-deps
  Line 201:42:  React Hook useEffect has a missing dependency: 'fetchStories'. Either include it or remove the dependency array
react-hooks/exhaustive-deps

src\store\zustand\useAuthStore.js
  Line 185:23:  'user' is assigned a value but never used  no-unused-vars

webpack compiled with 2 warnings
