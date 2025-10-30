import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    FlatList,
    SafeAreaView
} from 'react-native';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    where,
    Timestamp
} from 'firebase/firestore';
import { db, auth } from '../../firebase.config';

interface Event {
    id: string;
    title: string;
    description: string;
    date: any; // Firestore Timestamp
    time: string;
    location: string;
    category: 'school' | 'social' | 'sports' | 'playdate' | 'other';
    createdBy: string;
    createdByEmail: string;
    attendees: string[];
    maybeAttendees: string[];
    notAttending: string[];
    createdAt: any;
}

const getCategoryColor = (category: Event['category']) => {
    switch (category) {
        case 'school': return '#2c5f7c';
        case 'social': return '#4caf50';
        case 'sports': return '#ff9800';
        case 'playdate': return '#e91e63';
        default: return '#9e9e9e';
    }
};

const formatEventDate = (date: any) => {
    if (!date || !date.toDate) return 'TBD';
    const eventDate = date.toDate();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (eventDate.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (eventDate.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
    } else {
        return eventDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }
};

export default function CalendarScreen() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddEvent, setShowAddEvent] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);

    // Form states
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [month, setMonth] = useState('');
    const [day, setDay] = useState('');
    const [year, setYear] = useState('');
    const [time, setTime] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState<Event['category']>('other');

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = () => {
        // Remove orderBy to avoid index requirement for now
        const q = query(collection(db, 'events'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log('Loaded events from Firestore:', snapshot.docs.length);

            const eventsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Event));

            console.log('Events data:', eventsData);

            // Filter to show only upcoming events and sort client-side
            const now = new Date();
            const upcomingEvents = eventsData
                .filter(event => {
                    if (event.date?.toDate) {
                        return event.date.toDate() >= now;
                    }
                    return true;
                })
                .sort((a, b) => {
                    if (!a.date?.toDate || !b.date?.toDate) return 0;
                    return a.date.toDate().getTime() - b.date.toDate().getTime();
                });

            console.log('Upcoming events:', upcomingEvents);
            setEvents(upcomingEvents);
            setLoading(false);
        }, (error) => {
            console.error('Error loading events:', error);
            setLoading(false);
        });

        return unsubscribe;
    };

    const handleAddEvent = async () => {
        if (!title.trim() || !month.trim() || !day.trim() || !year.trim() || !time.trim()) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        try {
            // Parse date fields into Firestore Timestamp
            const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) :
                parseInt(year) < 100 ? 1900 + parseInt(year) : parseInt(year);
            const eventDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));

            console.log('Creating event with date:', eventDate);

            await addDoc(collection(db, 'events'), {
                title: title.trim(),
                description: description.trim(),
                date: Timestamp.fromDate(eventDate),
                time: time.trim(),
                location: location.trim(),
                category: 'other',
                createdBy: auth.currentUser!.uid,
                createdByEmail: auth.currentUser!.email,
                attendees: [],
                maybeAttendees: [],
                notAttending: [],
                createdAt: serverTimestamp()
            });

            // Clear form
            setTitle('');
            setDescription('');
            setMonth('');
            setDay('');
            setYear('');
            setTime('');
            setLocation('');
            setCategory('other');
            setShowAddEvent(false);

            Alert.alert('Success', 'Event added successfully!');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleRSVP = async (eventId: string, response: 'going' | 'maybe' | 'not-going') => {
        if (!auth.currentUser) return;

        try {
            const eventRef = doc(db, 'events', eventId);
            const userId = auth.currentUser.uid;

            // Remove user from all RSVP arrays first
            await updateDoc(eventRef, {
                attendees: arrayRemove(userId),
                maybeAttendees: arrayRemove(userId),
                notAttending: arrayRemove(userId)
            });

            // Add to appropriate array
            const field = response === 'going' ? 'attendees' :
                response === 'maybe' ? 'maybeAttendees' : 'notAttending';

            await updateDoc(eventRef, {
                [field]: arrayUnion(userId)
            });

        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleEdit = (event: Event) => {
        setEditingEvent(event);
        // Parse the date from the event
        if (event.date?.toDate) {
            const eventDate = event.date.toDate();
            setMonth((eventDate.getMonth() + 1).toString());
            setDay(eventDate.getDate().toString());
            setYear(eventDate.getFullYear().toString());
        }
        setTitle(event.title);
        setDescription(event.description);
        setTime(event.time);
        setLocation(event.location);
        setCategory(event.category);
        setSelectedEvent(null); // Close the details modal
    };

    const handleUpdate = async () => {
        if (!editingEvent || !title.trim() || !month.trim() || !day.trim() || !year.trim() || !time.trim()) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        try {
            // Parse date fields into Firestore Timestamp
            const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) :
                parseInt(year) < 100 ? 1900 + parseInt(year) : parseInt(year);
            const eventDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));

            await updateDoc(doc(db, 'events', editingEvent.id), {
                title: title.trim(),
                description: description.trim(),
                date: Timestamp.fromDate(eventDate),
                time: time.trim(),
                location: location.trim(),
                category: category,
                editedAt: serverTimestamp(),
            });

            // Clear form
            setTitle('');
            setDescription('');
            setMonth('');
            setDay('');
            setYear('');
            setTime('');
            setLocation('');
            setCategory('other');
            setEditingEvent(null);

            Alert.alert('Success', 'Event updated successfully!');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleDelete = async (eventId: string) => {
        Alert.alert(
            'Delete Event',
            'Are you sure you want to delete this event?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'events', eventId));
                            setSelectedEvent(null);
                            Alert.alert('Success', 'Event deleted successfully!');
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Community Calendar</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddEvent(true)}
                >
                    <Text style={styles.addButtonText}>+ Add Event</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.eventsList}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Loading events...</Text>
                    </View>
                ) : events.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyTitle}>No upcoming events</Text>
                        <Text style={styles.emptySubtitle}>Be the first to add a community event!</Text>
                    </View>
                ) : (
                    events.map(event => {
                        // Check if user is the creator - handle both createdBy (new) and userId (legacy) fields
                        const isCreator = event.createdBy === auth.currentUser?.uid || 
                                        (!event.createdBy && event.createdByEmail === auth.currentUser?.email);
                        
                        // Debug logging to help troubleshoot
                        console.log('Event:', event.title);
                        console.log('  event.createdBy:', event.createdBy);
                        console.log('  event.createdByEmail:', event.createdByEmail);
                        console.log('  currentUser.uid:', auth.currentUser?.uid);
                        console.log('  currentUser.email:', auth.currentUser?.email);
                        console.log('  isCreator:', isCreator);
                        
                        return (
                            <View key={event.id} style={styles.eventCard}>
                                <TouchableOpacity
                                    onPress={() => setSelectedEvent(event)}
                                >
                                    <View style={styles.eventHeader}>
                                        <Text style={styles.eventDate}>
                                            {formatEventDate(event.date)} at {event.time}
                                        </Text>
                                    </View>
                                    <Text style={styles.eventTitle}>{event.title}</Text>
                                    <Text style={styles.eventLocation}>📍 {event.location}</Text>
                                    <Text style={styles.eventDescription} numberOfLines={2}>
                                        {event.description}
                                    </Text>
                                    <View style={styles.eventFooter}>
                                        <Text style={styles.attendeeCount}>
                                            👥 {event.attendees?.length || 0} attending
                                        </Text>
                                        <Text style={styles.createdBy}>
                                            by {event.createdByEmail}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                
                                {/* Edit and Delete buttons for event creator */}
                                {isCreator && (
                                    <View style={styles.eventCardActions}>
                                        <TouchableOpacity
                                            style={styles.eventCardActionButton}
                                            onPress={() => handleEdit(event)}
                                        >
                                            <Text style={styles.eventCardActionText}>✏️ Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.eventCardActionButton}
                                            onPress={() => handleDelete(event.id)}
                                        >
                                            <Text style={[styles.eventCardActionText, styles.deleteActionText]}>🗑️ Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Add Event Modal */}
            <Modal visible={showAddEvent} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowAddEvent(false)}>
                            <Text style={styles.modalCloseButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Add Event</Text>
                        <TouchableOpacity onPress={handleAddEvent}>
                            <Text style={styles.modalSaveButton}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        <Text style={styles.label}>Event Title *</Text>
                        <TextInput
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g. Playground Meetup"
                        />

                        <Text style={styles.label}>Date *</Text>
                        <View style={styles.dateRow}>
                            <View style={styles.dateField}>
                                <Text style={styles.dateLabel}>Month</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={month}
                                    onChangeText={setMonth}
                                    placeholder="MM"
                                    keyboardType="numeric"
                                    maxLength={2}
                                />
                            </View>
                            <View style={styles.dateField}>
                                <Text style={styles.dateLabel}>Day</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={day}
                                    onChangeText={setDay}
                                    placeholder="DD"
                                    keyboardType="numeric"
                                    maxLength={2}
                                />
                            </View>
                            <View style={styles.dateField}>
                                <Text style={styles.dateLabel}>Year</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={year}
                                    onChangeText={setYear}
                                    placeholder="YYYY"
                                    keyboardType="numeric"
                                    maxLength={4}
                                />
                            </View>
                        </View>

                        <Text style={styles.label}>Time *</Text>
                        <TextInput
                            style={styles.input}
                            value={time}
                            onChangeText={setTime}
                            placeholder="e.g. 10:00 AM"
                        />

                        <Text style={styles.label}>Location</Text>
                        <TextInput
                            style={styles.input}
                            value={location}
                            onChangeText={setLocation}
                            placeholder="e.g. Fairhaven Park"
                        />



                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Event details..."
                            multiline
                            numberOfLines={4}
                        />
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Edit Event Modal */}
            <Modal visible={!!editingEvent} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => {
                            setEditingEvent(null);
                            // Clear form
                            setTitle('');
                            setDescription('');
                            setMonth('');
                            setDay('');
                            setYear('');
                            setTime('');
                            setLocation('');
                            setCategory('other');
                        }}>
                            <Text style={styles.modalCloseButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Edit Event</Text>
                        <TouchableOpacity onPress={handleUpdate}>
                            <Text style={styles.modalSaveButton}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        <Text style={styles.label}>Event Title *</Text>
                        <TextInput
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g. Playground Meetup"
                        />

                        <Text style={styles.label}>Date *</Text>
                        <View style={styles.dateRow}>
                            <View style={styles.dateField}>
                                <Text style={styles.dateLabel}>Month</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={month}
                                    onChangeText={setMonth}
                                    placeholder="MM"
                                    keyboardType="numeric"
                                    maxLength={2}
                                />
                            </View>
                            <View style={styles.dateField}>
                                <Text style={styles.dateLabel}>Day</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={day}
                                    onChangeText={setDay}
                                    placeholder="DD"
                                    keyboardType="numeric"
                                    maxLength={2}
                                />
                            </View>
                            <View style={styles.dateField}>
                                <Text style={styles.dateLabel}>Year</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={year}
                                    onChangeText={setYear}
                                    placeholder="YYYY"
                                    keyboardType="numeric"
                                    maxLength={4}
                                />
                            </View>
                        </View>

                        <Text style={styles.label}>Time *</Text>
                        <TextInput
                            style={styles.input}
                            value={time}
                            onChangeText={setTime}
                            placeholder="e.g. 10:00 AM"
                        />

                        <Text style={styles.label}>Location</Text>
                        <TextInput
                            style={styles.input}
                            value={location}
                            onChangeText={setLocation}
                            placeholder="e.g. Fairhaven Park"
                        />

                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Event details..."
                            multiline
                            numberOfLines={4}
                        />
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Event Details Modal */}
            <Modal visible={!!selectedEvent} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setSelectedEvent(null)}>
                            <Text style={styles.modalCloseButton}>Close</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Event Details</Text>
                        <View style={styles.modalCloseButton} />
                    </View>

                    {selectedEvent && (
                        <ScrollView style={styles.modalContent}>
                            <Text style={styles.eventDetailTitle}>{selectedEvent.title}</Text>

                            <Text style={styles.eventDetailDate}>
                                📅 {formatEventDate(selectedEvent.date)} at {selectedEvent.time}
                            </Text>

                            <Text style={styles.eventDetailLocation}>
                                📍 {selectedEvent.location}
                            </Text>

                            <Text style={styles.eventDetailDescription}>
                                {selectedEvent.description}
                            </Text>

                            <Text style={styles.sectionTitle}>RSVP</Text>
                            <View style={styles.rsvpButtons}>
                                <TouchableOpacity
                                    style={[styles.rsvpButton, { backgroundColor: selectedEvent.attendees?.includes(auth.currentUser?.uid || '') ? '#4caf50' : '#f0f0f0' }]}
                                    onPress={() => handleRSVP(selectedEvent.id, 'going')}
                                >
                                    <Text style={[styles.rsvpButtonText, { color: selectedEvent.attendees?.includes(auth.currentUser?.uid || '') ? '#fff' : '#333' }]}>
                                        ✓ Going ({selectedEvent.attendees?.length || 0})
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.rsvpButton, { backgroundColor: selectedEvent.maybeAttendees?.includes(auth.currentUser?.uid || '') ? '#ff9800' : '#f0f0f0' }]}
                                    onPress={() => handleRSVP(selectedEvent.id, 'maybe')}
                                >
                                    <Text style={[styles.rsvpButtonText, { color: selectedEvent.maybeAttendees?.includes(auth.currentUser?.uid || '') ? '#fff' : '#333' }]}>
                                        ? Maybe ({selectedEvent.maybeAttendees?.length || 0})
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.rsvpButton, { backgroundColor: selectedEvent.notAttending?.includes(auth.currentUser?.uid || '') ? '#f44336' : '#f0f0f0' }]}
                                    onPress={() => handleRSVP(selectedEvent.id, 'not-going')}
                                >
                                    <Text style={[styles.rsvpButtonText, { color: selectedEvent.notAttending?.includes(auth.currentUser?.uid || '') ? '#fff' : '#333' }]}>
                                        ✗ Can't Go ({selectedEvent.notAttending?.length || 0})
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.createdByDetail}>
                                Created by {selectedEvent.createdByEmail}
                            </Text>

                            {/* Edit and Delete buttons for event creator */}
                            {(selectedEvent.createdBy === auth.currentUser?.uid || 
                              (!selectedEvent.createdBy && selectedEvent.createdByEmail === auth.currentUser?.email)) && (
                                <View style={styles.creatorActions}>
                                    <TouchableOpacity
                                        style={styles.editEventButton}
                                        onPress={() => handleEdit(selectedEvent)}
                                    >
                                        <Text style={styles.editEventButtonText}>✏️ Edit Event</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.deleteEventButton}
                                        onPress={() => handleDelete(selectedEvent.id)}
                                    >
                                        <Text style={styles.deleteEventButtonText}>🗑️ Delete Event</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#2c5f7c',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    addButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    eventsList: {
        flex: 1,
        padding: 15,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    eventCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    eventHeader: {
        marginBottom: 10,
    },
    categoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    categoryText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    eventDate: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    eventLocation: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    eventDescription: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
        marginBottom: 12,
    },
    eventFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    attendeeCount: {
        fontSize: 12,
        color: '#2c5f7c',
        fontWeight: '500',
    },
    createdBy: {
        fontSize: 12,
        color: '#999',
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#2c5f7c',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    modalCloseButton: {
        color: '#fff',
        fontSize: 16,
        width: 60,
    },
    modalSaveButton: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        marginTop: 15,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    dateRow: {
        flexDirection: 'row',
        gap: 10,
    },
    dateField: {
        flex: 1,
    },
    dateLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    dateInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
        textAlign: 'center',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    categoryScroll: {
        marginVertical: 10,
    },
    categoryButton: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
    },
    categoryButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    // Event detail styles
    eventDetailTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    eventDetailDate: {
        fontSize: 16,
        color: '#2c5f7c',
        marginBottom: 10,
        fontWeight: '500',
    },
    eventDetailLocation: {
        fontSize: 16,
        color: '#666',
        marginBottom: 15,
    },
    eventDetailDescription: {
        fontSize: 16,
        color: '#555',
        lineHeight: 24,
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    rsvpButtons: {
        marginBottom: 25,
    },
    rsvpButton: {
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        alignItems: 'center',
    },
    rsvpButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    createdByDetail: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginTop: 20,
    },
    creatorActions: {
        marginTop: 20,
        gap: 10,
    },
    editEventButton: {
        backgroundColor: '#2c5f7c',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    editEventButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    deleteEventButton: {
        backgroundColor: '#d32f2f',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    deleteEventButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    eventCardActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    eventCardActionButton: {
        flex: 1,
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
    },
    eventCardActionText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    deleteActionText: {
        color: '#d32f2f',
    },
});