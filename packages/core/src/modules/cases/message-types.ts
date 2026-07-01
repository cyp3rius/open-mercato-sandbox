import type { MessageTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { DefaultMessageActions } from '../messages/components/defaults/DefaultMessageActions'
import { DefaultMessageListItem } from '../messages/components/defaults/DefaultMessageListItem'
import { ProcedureNotifyMessageContent } from './components/messages/ProcedureNotifyMessageContent'
import {
  CASES_PROCEDURE_NOTIFY_CUSTOMER_MESSAGE_TYPE,
  CASES_PROCEDURE_NOTIFY_OWNER_MESSAGE_TYPE,
} from './lib/procedureNotifyMessageTypes'

export const messageTypes: MessageTypeDefinition[] = [
  {
    type: CASES_PROCEDURE_NOTIFY_OWNER_MESSAGE_TYPE,
    module: 'cases',
    labelKey: 'cases.messages.procedureNotify.owner',
    icon: 'bell',
    color: 'blue',
    ui: {
      listItemComponent: 'messages.default.listItem',
      contentComponent: 'cases.procedureNotify.content',
      actionsComponent: 'messages.default.actions',
    },
    ListItemComponent: DefaultMessageListItem,
    ContentComponent: ProcedureNotifyMessageContent,
    ActionsComponent: DefaultMessageActions,
    allowReply: false,
    allowForward: false,
  },
  {
    type: CASES_PROCEDURE_NOTIFY_CUSTOMER_MESSAGE_TYPE,
    module: 'cases',
    labelKey: 'cases.messages.procedureNotify.customer',
    icon: 'mail',
    color: 'green',
    ui: {
      listItemComponent: 'messages.default.listItem',
      contentComponent: 'cases.procedureNotify.content',
      actionsComponent: 'messages.default.actions',
    },
    ListItemComponent: DefaultMessageListItem,
    ContentComponent: ProcedureNotifyMessageContent,
    ActionsComponent: DefaultMessageActions,
    allowReply: false,
    allowForward: false,
  },
]

export default messageTypes
