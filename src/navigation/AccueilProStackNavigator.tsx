import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AccueilProHomeScreen from '../screens/accueilpro/AccueilProHomeScreen';
import AccueilProVenuesScreen from '../screens/accueilpro/AccueilProVenuesScreen';
import AccueilProVenueDetailScreen from '../screens/accueilpro/AccueilProVenueDetailScreen';
import AccueilProVenueEditScreen from '../screens/accueilpro/AccueilProVenueEditScreen';
import AccueilProVenueSpacesScreen from '../screens/accueilpro/AccueilProVenueSpacesScreen';
import AccueilProSpaceEditScreen from '../screens/accueilpro/AccueilProSpaceEditScreen';
import AccueilProEventsScreen from '../screens/accueilpro/AccueilProEventsScreen';
import AccueilProEventEditScreen from '../screens/accueilpro/AccueilProEventEditScreen';
import AccueilProEventDetailScreen from '../screens/accueilpro/AccueilProEventDetailScreen';
import AccueilProEventPersonnelScreen from '../screens/accueilpro/AccueilProEventPersonnelScreen';
import AccueilProInspectionsScreen from '../screens/accueilpro/AccueilProInspectionsScreen';
import AccueilProInspectionEditScreen from '../screens/accueilpro/AccueilProInspectionEditScreen';
import AccueilProPlanningScreen from '../screens/accueilpro/AccueilProPlanningScreen';
import AccueilProConventionsScreen from '../screens/accueilpro/AccueilProConventionsScreen';
import AccueilProConventionEditScreen from '../screens/accueilpro/AccueilProConventionEditScreen';
import AccueilProFeuilleRouteScreen from '../screens/accueilpro/AccueilProFeuilleRouteScreen';
import AccueilProFeuilleRouteEventScreen from '../screens/accueilpro/AccueilProFeuilleRouteEventScreen';
import AccueilProDayPlanScreen from '../screens/accueilpro/AccueilProDayPlanScreen';
import AccueilProDayPlanEditScreen from '../screens/accueilpro/AccueilProDayPlanEditScreen';
import AccueilProPersonnelScreen from '../screens/accueilpro/AccueilProPersonnelScreen';
import AccueilProPersonnelEditScreen from '../screens/accueilpro/AccueilProPersonnelEditScreen';
import AccueilProContactsScreen from '../screens/accueilpro/AccueilProContactsScreen';
import AccueilProOrganizationsScreen from '../screens/accueilpro/AccueilProOrganizationsScreen';
import AccueilProOrganizationEditScreen from '../screens/accueilpro/AccueilProOrganizationEditScreen';
import AccueilProOrganizationContactsScreen from '../screens/accueilpro/AccueilProOrganizationContactsScreen';
import AccueilProInviteOrganizationScreen from '../screens/accueilpro/AccueilProInviteOrganizationScreen';
import AccueilProConflictsScreen from '../screens/accueilpro/AccueilProConflictsScreen';
import AccueilProActivityLogScreen from '../screens/accueilpro/AccueilProActivityLogScreen';
import AccueilProPortalEventDocumentsScreen from '../screens/accueilpro/AccueilProPortalEventDocumentsScreen';
import AccueilProEventInspectionCompareScreen from '../screens/accueilpro/AccueilProEventInspectionCompareScreen';
import AccueilAssociationScreen from '../screens/AccueilAssociationScreen';

export type AccueilProStackParamList = {
  AccueilProHome: undefined;
  AccueilProVenues: { venueId?: string; spaceId?: string; returnToEvent?: boolean; eventEditId?: string };
  AccueilProVenueDetail: { id: string };
  AccueilProVenueEdit: { id?: string; returnToEvent?: boolean; eventEditId?: string };
  AccueilProVenueSpaces: { venueId: string };
  AccueilProSpaceEdit: { venueId: string; id?: string; returnToEvent?: boolean; eventEditId?: string };
  AccueilProEvents: { filter?: 'today' | 'week' | 'all' };
  AccueilProEventEdit: { id?: string; selectOrganizationId?: string; selectOrganizationName?: string; selectVenueId?: string };
  AccueilProEventDetail: { id: string };
  AccueilProEventPersonnel: { eventId: string };
  AccueilProInspections: undefined;
  AccueilProInspectionEdit: { id?: string; eventId?: string; spaceId?: string; type?: string };
  AccueilProPlanning: undefined;
  AccueilProConventions: undefined;
  AccueilProConventionEdit: { id?: string; eventId?: string; venueId?: string; signNow?: boolean };
  AccueilProFeuilleRoute: undefined;
  AccueilProFeuilleRouteEvent: { eventId: string };
  AccueilProDayPlan: { date?: string };
  AccueilProDayPlanEdit: { id?: string; date: string; eventId?: string };
  AccueilProPersonnel: { kind?: string; venueId?: string; organizationId?: string };
  AccueilProPersonnelEdit: { id?: string; kind?: string; venueId?: string; organizationId?: string };
  AccueilProContacts: undefined;
  AccueilProOrganizations: undefined;
  AccueilProOrganizationEdit: { id?: string; returnToEvent?: boolean; eventEditId?: string };
  AccueilProOrganizationContacts: { organizationId: string };
  AccueilProInviteOrganization: { localOrganizationId?: string; prefillEmail?: string };
  AccueilProConflicts: undefined;
  AccueilProActivityLog: undefined;
  AccueilAssociation: undefined;
  AccueilProPortalEventDocuments: {
    eventId: string;
    organizationId: string;
    eventName?: string;
    organizationName?: string;
  };
  AccueilProEventInspectionCompare: { eventId: string };
};

const Stack = createStackNavigator<AccueilProStackParamList>();

export function AccueilProStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="AccueilProHome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccueilProHome" component={AccueilProHomeScreen} />
      <Stack.Screen name="AccueilProVenues" component={AccueilProVenuesScreen} />
      <Stack.Screen name="AccueilProVenueDetail" component={AccueilProVenueDetailScreen} />
      <Stack.Screen name="AccueilProVenueEdit" component={AccueilProVenueEditScreen} />
      <Stack.Screen name="AccueilProVenueSpaces" component={AccueilProVenueSpacesScreen} />
      <Stack.Screen name="AccueilProSpaceEdit" component={AccueilProSpaceEditScreen} />
      <Stack.Screen name="AccueilProEvents" component={AccueilProEventsScreen} />
      <Stack.Screen name="AccueilProEventEdit" component={AccueilProEventEditScreen} />
      <Stack.Screen name="AccueilProEventDetail" component={AccueilProEventDetailScreen} />
      <Stack.Screen name="AccueilProEventPersonnel" component={AccueilProEventPersonnelScreen} />
      <Stack.Screen name="AccueilProInspections" component={AccueilProInspectionsScreen} />
      <Stack.Screen name="AccueilProInspectionEdit" component={AccueilProInspectionEditScreen} />
      <Stack.Screen name="AccueilProPlanning" component={AccueilProPlanningScreen} />
      <Stack.Screen name="AccueilProConventions" component={AccueilProConventionsScreen} />
      <Stack.Screen name="AccueilProConventionEdit" component={AccueilProConventionEditScreen} />
      <Stack.Screen name="AccueilProFeuilleRoute" component={AccueilProFeuilleRouteScreen} />
      <Stack.Screen name="AccueilProFeuilleRouteEvent" component={AccueilProFeuilleRouteEventScreen} />
      <Stack.Screen name="AccueilProDayPlan" component={AccueilProDayPlanScreen} />
      <Stack.Screen name="AccueilProDayPlanEdit" component={AccueilProDayPlanEditScreen} />
      <Stack.Screen name="AccueilProPersonnel" component={AccueilProPersonnelScreen} />
      <Stack.Screen name="AccueilProPersonnelEdit" component={AccueilProPersonnelEditScreen} />
      <Stack.Screen name="AccueilProContacts" component={AccueilProContactsScreen} />
      <Stack.Screen name="AccueilProOrganizations" component={AccueilProOrganizationsScreen} />
      <Stack.Screen name="AccueilProOrganizationEdit" component={AccueilProOrganizationEditScreen} />
      <Stack.Screen name="AccueilProOrganizationContacts" component={AccueilProOrganizationContactsScreen} />
      <Stack.Screen name="AccueilProInviteOrganization" component={AccueilProInviteOrganizationScreen} />
      <Stack.Screen name="AccueilProConflicts" component={AccueilProConflictsScreen} />
      <Stack.Screen name="AccueilProActivityLog" component={AccueilProActivityLogScreen} />
      <Stack.Screen name="AccueilAssociation" component={AccueilAssociationScreen} />
      <Stack.Screen name="AccueilProPortalEventDocuments" component={AccueilProPortalEventDocumentsScreen} />
      <Stack.Screen name="AccueilProEventInspectionCompare" component={AccueilProEventInspectionCompareScreen} />
    </Stack.Navigator>
  );
}
