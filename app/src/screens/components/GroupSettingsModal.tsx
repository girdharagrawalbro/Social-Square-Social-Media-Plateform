import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { api } from '../../lib/api';

interface SearchUser {
  _id: string;
  fullname: string;
  username: string;
  profile_picture?: string;
}

export default function GroupSettingsModal({
  visible, onClose, conversationId, currentUser, isDark, textColor, subColor, cardBg, borderColor, onLeave
}: any) {
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<any>(null);
  
  const [groupName, setGroupName] = useState('');
  const [savingName, setSavingName] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [addingMembers, setAddingMembers] = useState<SearchUser[]>([]);

  useEffect(() => {
    if (visible && conversationId) fetchGroup();
  }, [visible, conversationId]);

  const fetchGroup = async () => {
    setLoading(true);
    try {
      // Find the group in the list of conversations
      const res = await api.get('/api/conversation');
      const conv = res.data?.conversations?.find((c: any) => c._id === conversationId);
      if (conv) {
        setGroup(conv);
        setGroupName(conv.groupName || '');
      }
    } catch (e) {
      console.warn('Failed to load group details', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!groupName.trim() || groupName === group.groupName) return;
    setSavingName(true);
    try {
      await api.patch(`/api/conversation/group/${conversationId}/update`, { name: groupName });
      setGroup((prev: any) => ({ ...prev, groupName }));
      Alert.alert('Success', 'Group name updated');
    } catch (e) {
      Alert.alert('Error', 'Failed to update group name');
    } finally {
      setSavingName(false);
    }
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/api/auth/search?query=${query}`);
      setSearchResults(res.data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setSearching(false);
    }
  };

  const handleAddMembers = async () => {
    if (addingMembers.length === 0) return;
    try {
      await api.post(`/api/conversation/group/${conversationId}/add-members`, {
        memberIds: addingMembers.map(m => m._id)
      });
      setAddingMembers([]);
      setSearchQuery('');
      setSearchResults([]);
      fetchGroup();
      Alert.alert('Success', 'Members added');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to add members');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    Alert.alert('Remove Member', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/api/conversation/group/${conversationId}/remove-members`, {
            memberIds: [memberId]
          });
          fetchGroup();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.message || 'Failed to remove member');
        }
      }}
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/api/conversation/group/${conversationId}/leave`);
          onClose();
          onLeave();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.message || 'Failed to leave group');
        }
      }}
    ]);
  };

  const isAdmin = group?.groupAdmins?.includes(currentUser?._id);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: cardBg, height: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor }}>
            <Text style={{ color: textColor, fontSize: 18, fontWeight: 'bold' }}>Group Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#808bf5" style={{ padding: 40 }} />
          ) : !group ? (
            <Text style={{ color: subColor, padding: 20, textAlign: 'center' }}>Group not found.</Text>
          ) : (
            <FlatList
              data={[]}
              renderItem={() => null}
              ListHeaderComponent={
                <View style={{ padding: 16 }}>
                  {/* Name Edit */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <TextInput
                      style={{ flex: 1, color: textColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', padding: 12, borderRadius: 8, marginRight: 8 }}
                      value={groupName}
                      onChangeText={setGroupName}
                      placeholder="Group Name"
                      placeholderTextColor={subColor}
                    />
                    {groupName !== group.groupName && (
                      <TouchableOpacity onPress={handleUpdateName} disabled={savingName} style={{ backgroundColor: '#808bf5', padding: 12, borderRadius: 8 }}>
                        {savingName ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff' }}>Save</Text>}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Member List */}
                  <Text style={{ color: subColor, fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>MEMBERS ({group.participants?.length || 0})</Text>
                  {group.participants?.map((p: any) => {
                    const u = p.userId || p;
                    const isGroupAdmin = group.groupAdmins?.includes(u._id);
                    return (
                      <View key={u._id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          {u.profile_picture ? (
                            <Image source={{ uri: u.profile_picture }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                          ) : (
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{u.fullname?.[0]?.toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: textColor, fontWeight: '500' }}>{u.fullname} {u._id === currentUser?._id && '(You)'}</Text>
                          <Text style={{ color: subColor, fontSize: 12 }}>@{u.username}</Text>
                        </View>
                        {isGroupAdmin && <Text style={{ color: '#10b981', fontSize: 12, marginRight: 8 }}>Admin</Text>}
                        {isAdmin && u._id !== currentUser?._id && (
                          <TouchableOpacity onPress={() => handleRemoveMember(u._id)}>
                            <MaterialCommunityIcons name="account-remove" size={20} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {/* Add Members Section */}
                  <View style={{ marginTop: 24 }}>
                    <Text style={{ color: subColor, fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>ADD MEMBERS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12 }}>
                      <MaterialCommunityIcons name="magnify" size={20} color={subColor} />
                      <TextInput
                        style={{ flex: 1, padding: 12, color: textColor }}
                        placeholder="Search users..."
                        placeholderTextColor={subColor}
                        value={searchQuery}
                        onChangeText={handleSearchUsers}
                      />
                    </View>

                    {addingMembers.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {addingMembers.map(m => (
                          <TouchableOpacity key={m._id} style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center' }}
                            onPress={() => setAddingMembers(prev => prev.filter(x => x._id !== m._id))}>
                            <Text style={{ color: '#4f46e5', fontSize: 12, marginRight: 4 }}>{m.fullname}</Text>
                            <MaterialCommunityIcons name="close" size={14} color="#4f46e5" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {addingMembers.length > 0 && (
                      <TouchableOpacity onPress={handleAddMembers} style={{ backgroundColor: '#808bf5', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add Selected Users</Text>
                      </TouchableOpacity>
                    )}

                    {searching ? (
                      <ActivityIndicator color="#808bf5" />
                    ) : searchResults.length > 0 && (
                      <View style={{ maxHeight: 200, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: 8, padding: 8 }}>
                        {searchResults.map(u => {
                          // don't show if already in group
                          if (group.participants?.some((p: any) => (p.userId?._id || p._id) === u._id)) return null;
                          const isSelected = addingMembers.some(m => m._id === u._id);
                          return (
                            <TouchableOpacity key={u._id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }} onPress={() => {
                              if (isSelected) setAddingMembers(prev => prev.filter(m => m._id !== u._id));
                              else setAddingMembers(prev => [...prev, u]);
                            }}>
                              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                {u.profile_picture ? (
                                  <Image source={{ uri: u.profile_picture }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                                ) : (
                                  <Text style={{ color: '#fff' }}>{u.fullname?.[0]?.toUpperCase()}</Text>
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: textColor }}>{u.fullname}</Text>
                                <Text style={{ color: subColor, fontSize: 12 }}>@{u.username}</Text>
                              </View>
                              {isSelected && <MaterialCommunityIcons name="check-circle" size={20} color="#808bf5" />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  <TouchableOpacity onPress={handleLeaveGroup} style={{ marginTop: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#ef4444', borderRadius: 8 }}>
                    <MaterialCommunityIcons name="logout" size={20} color="#ef4444" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Leave Group</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
