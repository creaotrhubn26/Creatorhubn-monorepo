import authSessionService from '../services/authSessionService';

export type BrandingTextTokenKey =
  | 'casting'
  | 'roles'
  | 'candidates'
  | 'auditions'
  | 'team'
  | 'locations'
  | 'equipment'
  | 'schedule'
  | 'shotList'
  | 'callSheets'
  | 'projects'
  | 'dashboard'
  | 'storyboard'
  | 'sharing'
  | 'crewCalendar'
  | 'overviewDescription'
  | 'newProjectTitle'
  | 'teamDescription'
  | 'locationsDescription'
  | 'equipmentDescription'
  | 'scheduleDescription'
  | 'scheduleProductionLabel'
  | 'shotListDescriptionPhoto'
  | 'shotListDescriptionVideo'
  | 'sharingDescription'
  | 'noProjectSelected'
  | 'noAccessTeam'
  | 'noAccessLocations'
  | 'noAccessEquipment'
  | 'noAccessSchedule'
  | 'noAccessShotList'
  | 'noAccessSharing'
  | 'mustCreateProject'
  | 'needCandidateAndRole'
  | 'assignedRolesLabel'
  | 'consentSignedLabel'
  | 'unknownRoleLabel'
  | 'roleOwnerLabel'
  | 'roleAdminLabel'
  | 'roleDirectorLabel'
  | 'roleProducerLabel'
  | 'roleCastingDirectorLabel'
  | 'roleProductionManagerLabel'
  | 'roleCameraTeamLabel'
  | 'roleAgencyLabel'
  | 'roleNameRequired'
  | 'roleSaveError'
  | 'confirmDeleteRole'
  | 'roleDeleteError'
  | 'roleDeleteSuccess'
  | 'candidateNameRequired'
  | 'candidateSaveError'
  | 'confirmDeleteCandidate'
  | 'candidateDeleteError'
  | 'scheduleSaveError'
  | 'confirmDeleteSchedule'
  | 'scheduleDeleteError'
  | 'scheduleLabel'
  | 'removeUserLabel'
  | 'confirmRemoveUserLabel'
  | 'removeUserErrorLabel'
  | 'activeProjectLabel'
  | 'editProjectAriaLabel'
  | 'editProjectLabel'
  | 'confirmDeleteProjectWithWarning'
  | 'projectDeleteError'
  | 'deleteProjectAriaLabel'
  | 'deleteProjectLabel'
  | 'tutorialLabel'
  | 'tutorialTitle'
  | 'switchProfessionLabel'
  | 'editTutorialsLabel'
  | 'manageUsersLabel'
  | 'confirmResetDemoProjects'
  | 'demoDataResetSuccess'
  | 'resetDemoDataLabel'
  | 'showIntroLabel'
  | 'showIntroTitle'
  | 'logoutLabel'
  | 'loginLabel'
  | 'rolesStatLabel'
  | 'candidatesStatLabel'
  | 'upcomingStatLabel'
  | 'exitFullscreenLabel'
  | 'enterFullscreenLabel'
  | 'closePanelLabel'
  | 'loadingLabel'
  | 'searchCandidatesPlaceholder'
  | 'candidateStatusAll'
  | 'candidateStatusPending'
  | 'candidateStatusRequested'
  | 'candidateStatusShortlist'
  | 'candidateStatusSelected'
  | 'candidateStatusConfirmed'
  | 'candidateStatusRejected'
  | 'listViewLabel'
  | 'kanbanViewLabel'
  | 'draggingCandidateLabel'
  | 'cancelLabel'
  | 'quickContactLabel'
  | 'emailTooltipPrefix'
  | 'callTooltipPrefix'
  | 'dateLabel'
  | 'candidateLabel'
  | 'roleLabel'
  | 'allCandidatesLabel'
  | 'allRolesLabel'
  | 'resetFiltersLabel'
  | 'roleDialogNewTitle'
  | 'roleDialogEditTitle'
  | 'roleBasicsSectionLabel'
  | 'roleNameLabel'
  | 'roleDescriptionLabel'
  | 'roleMinAgeLabel'
  | 'roleMaxAgeLabel'
  | 'genderLabel'
  | 'genderMaleLabel'
  | 'genderFemaleLabel'
  | 'genderNonBinaryLabel'
  | 'genderAllLabel'
  | 'statusLabel'
  | 'roleStatusDraft'
  | 'roleStatusOpen'
  | 'roleStatusCasting'
  | 'roleStatusFilled'
  | 'roleStatusCancelled'
  | 'roleRequirementsSectionLabel'
  | 'roleAppearanceLabel'
  | 'roleAppearancePlaceholder'
  | 'roleSkillsLabel'
  | 'roleSkillsPlaceholder'
  | 'roleSpecialNeedsLabel'
  | 'roleSpecialNeedsPlaceholder'
  | 'roleScenesLabel'
  | 'roleCrewLabel'
  | 'roleLocationsLabel'
  | 'rolePropsLabel'
  | 'saveRoleLabel'
  | 'deleteLabel'
  | 'candidateDialogNewTitle'
  | 'candidateDialogEditTitle'
  | 'nameLabel'
  | 'emailLabel'
  | 'phoneLabel'
  | 'addressLabel'
  | 'mediaSectionLabel'
  | 'uploadMediaLabel'
  | 'candidatePhotoAltLabel'
  | 'auditionNotesLabel'
  | 'emergencyContactSectionLabel'
  | 'relationshipLabel'
  | 'consentSectionLabel'
  | 'sendConsentOnSaveLabel'
  | 'consentSendHelpText'
  | 'saveLabel'
  | 'scheduleDialogNewTitle'
  | 'scheduleDialogEditTitle'
  | 'timeLabel'
  | 'locationLabel'
  | 'noLocationLabel'
  | 'locationFallbackLabel'
  | 'locationFallbackPlaceholder'
  | 'sceneOptionalLabel'
  | 'noSceneLabel'
  | 'notesLabel'
  | 'notesPlaceholder'
  | 'scheduleStatusScheduled'
  | 'scheduleStatusCompleted'
  | 'scheduleStatusCancelled'
  | 'allProjectsLabel'
  | 'lastUpdatedLabel'
  | 'unknownLabel'
  | 'candidatesCountLabel'
  | 'confirmDeleteProjectShort'
  | 'confirmDeleteProjectDialogBody'
  | 'deleteProjectWarning'
  | 'projectDeleteErrorShort'
  | 'closeLabel'
  | 'projectIdLabel'
  | 'editProjectTitle'
  | 'newCastingProjectTitle'
  | 'newProjectPrefix'
  | 'sceneFallbackPrefix'
  | 'professionPhotographerName'
  | 'termPhotoProject'
  | 'termPhotoShot'
  | 'termPhotoShoot'
  | 'termPhotoShootDay'
  | 'termPhotoShotList'
  | 'termPhotoPortfolio'
  | 'termPhotoSingle'
  | 'termPhotoPlural'
  | 'professionVideographerName'
  | 'termVideoProject'
  | 'termVideoShot'
  | 'termVideoShoot'
  | 'termVideoShootDay'
  | 'termVideoShotList'
  | 'termVideoPortfolio'
  | 'termVideoSingle'
  | 'termVideoPlural'
  | 'propsHeaderLabel'
  | 'storyArcBackLabel'
  | 'fabLabel'
  | 'fabIcon'
  | 'importDialogTitle'
  | 'importDialogInfo'
  | 'importSelectFile'
  | 'importFileFormat'
  | 'importValidationErrorTitle'
  | 'importValidatedSuccess'
  | 'importMetadataTitle'
  | 'importContentTitle'
  | 'importFieldTitle'
  | 'importFieldAuthor'
  | 'importFieldFormat'
  | 'importFieldExported'
  | 'importStatsScenes'
  | 'importStatsActs'
  | 'importStatsCharacters'
  | 'importStatsDialogue'
  | 'importStatsRevisions'
  | 'importStatsRuntime'
  | 'importIdWarning'
  | 'importImporting'
  | 'importCompleteTitle'
  | 'importCompleteBody'
  | 'importCancel'
  | 'importChooseAnother'
  | 'importAction'
  | 'importClose'
  | 'importToastFileLoaded'
  | 'importToastUnknownError'
  | 'importToastReadError'
  | 'importToastImported'
  | 'importToastImportFailed'
  | 'manuscriptHeader'
  | 'manuscriptHeaderMobile'
  | 'manuscriptAutoBreakdown'
  | 'manuscriptAutoShort'
  | 'manuscriptExport'
  | 'manuscriptSave'
  | 'manuscriptImport'
  | 'manuscriptTemplates'
  | 'manuscriptNew'
  | 'manuscriptNewShort'
  | 'manuscriptListTitle'
  | 'manuscriptOpenHint'
  | 'manuscriptNoProjectMessage'
  | 'manuscriptNoProjectTitle'
  | 'manuscriptOpenButton'
  | 'manuscriptUnknownAuthor'
  | 'manuscriptDeleteConfirm'
  | 'manuscriptEmptyTitle'
  | 'manuscriptEmptyBody'
  | 'manuscriptEmptyCta'
  | 'manuscriptBackShort'
  | 'manuscriptBackLong'
  | 'exportTooltip'
  | 'importTooltip'
  | 'manuscriptUploadCoverTooltip'
  | 'manuscriptEditTooltip'
  | 'manuscriptDeleteTooltip'
  | 'manuscriptCoverLabel'
  | 'manuscriptUploadCoverButton'
  | 'manuscriptRemoveCoverButton'
  | 'manuscriptCoverHint'
  | 'manuscriptDialogNewTitle'
  | 'manuscriptDialogEditTitle'
  | 'manuscriptFieldTitleLabel'
  | 'manuscriptFieldSubtitleLabel'
  | 'manuscriptFieldAuthorLabel'
  | 'manuscriptFieldFormatLabel'
  | 'manuscriptFormatFountain'
  | 'manuscriptFormatMarkdown'
  | 'manuscriptFormatFinalDraft'
  | 'manuscriptDialogCancel'
  | 'manuscriptDialogCreate'
  | 'manuscriptDialogStatusLabel'
  | 'manuscriptStatusDraft'
  | 'manuscriptStatusReview'
  | 'manuscriptStatusApproved'
  | 'manuscriptStatusProduction'
  | 'manuscriptStatusCompleted'
  | 'manuscriptDialogSaveChanges'
  | 'manuscriptUpdatedSuccess'
  | 'manuscriptToastLoaded'
  | 'manuscriptToastLoadError'
  | 'manuscriptToastLoadScenesError'
  | 'manuscriptToastLoadActsError'
  | 'manuscriptToastLoadDialogueError'
  | 'manuscriptToastLoadRevisionsError'
  | 'manuscriptToastOnline'
  | 'manuscriptToastOffline'
  | 'manuscriptToastMissingTitle'
  | 'manuscriptToastCreated'
  | 'manuscriptToastCreateError'
  | 'manuscriptToastSaved'
  | 'manuscriptToastSaveError'
  | 'manuscriptToastAutoBreakdownPrefix'
  | 'manuscriptToastAutoBreakdownScenesLabel'
  | 'manuscriptToastAutoBreakdownCharactersLabel'
  | 'manuscriptToastAutoBreakdownError'
  | 'manuscriptToastExported'
  | 'manuscriptToastExportError'
  | 'manuscriptToastImported'
  | 'manuscriptToastImportError'
  | 'manuscriptToastTemplateAppliedPrefix'
  | 'manuscriptToastTemplateAppliedSuffix'
  | 'manuscriptToastTemplateApplyError'
  | 'manuscriptToastTemplateInsertedPrefix'
  | 'manuscriptToastTemplateInsertedSuffix'
  | 'manuscriptToastParsedScenesPrefix'
  | 'manuscriptToastParsedScenesSuffix'
  | 'manuscriptToastDeleted'
  | 'manuscriptToastDeleteError'
  | 'manuscriptToastCoverUpdated'
  | 'manuscriptToastSceneSaved'
  | 'manuscriptToastSceneSaveError'
  | 'manuscriptToastSceneDeleted'
  | 'manuscriptToastSceneDeleteError'
  | 'manuscriptToastSceneCreated'
  | 'manuscriptToastSceneCreateError'
  | 'manuscriptToastSceneOrderUpdated'
  | 'manuscriptToastSceneOrderError'
  | 'manuscriptToastUpdateError'
  | 'manuscriptToastParsedHeadingsPrefix'
  | 'manuscriptToastParsedHeadingsSuffix'
  | 'manuscriptPagesSuffix'
  | 'manuscriptMinutesSuffix'
  | 'manuscriptScenesSuffix'
  | 'manuscriptCharactersSuffix'
  | 'manuscriptWordsSuffix'
  | 'manuscriptStatusDraftBadge'
  | 'manuscriptStatusReviewBadge'
  | 'manuscriptStatusApprovedBadge'
  | 'manuscriptStatusProductionBadge'
  | 'manuscriptStatusCompletedBadge'
  | 'manuscriptSavedLabelShort'
  | 'manuscriptSavedLabel'
  | 'manuscriptSavingLabel'
  | 'manuscriptUnsavedShort'
  | 'manuscriptUnsavedLong'
  | 'manuscriptSaveErrorTooltip'
  | 'manuscriptSaveErrorLabel'
  | 'manuscriptOnlineTooltip'
  | 'manuscriptOfflineTooltip'
  | 'manuscriptTabEditor'
  | 'manuscriptTabActs'
  | 'manuscriptTabScenes'
  | 'manuscriptTabCharacters'
  | 'manuscriptTabDialogue'
  | 'manuscriptTabBreakdown'
  | 'manuscriptTabRevisions'
  | 'manuscriptTabTimeline'
  | 'manuscriptTabProduction'
  | 'manuscriptTabProductionView'
  | 'manuscriptTooltipPages'
  | 'manuscriptTooltipRuntime'
  | 'manuscriptTooltipWords'
  | 'manuscriptTooltipHeadings'
  | 'manuscriptTooltipCharacters'
  | 'manuscriptEmptyIcon'
  | 'manuscriptActsTitle'
  | 'manuscriptActsAddShort'
  | 'manuscriptActsAddLong'
  | 'manuscriptActsEmptyTitle'
  | 'manuscriptActsEmptyBody'
  | 'manuscriptActsEmptyIcon'
  | 'manuscriptActsCardTitlePrefix'
  | 'manuscriptActsNoDescription'
  | 'manuscriptActsNoPages'
  | 'manuscriptActsPageLabel'
  | 'manuscriptActsTableNumber'
  | 'manuscriptActsTableTitle'
  | 'manuscriptActsTableDescription'
  | 'manuscriptActsTablePages'
  | 'manuscriptActsTableDuration'
  | 'manuscriptActsTableActions'
  | 'manuscriptActsDialogNewTitle'
  | 'manuscriptActsDialogEditTitle'
  | 'manuscriptActsFieldNumber'
  | 'manuscriptActsFieldTitle'
  | 'manuscriptActsFieldDescription'
  | 'manuscriptActsFieldPageStart'
  | 'manuscriptActsFieldPageEnd'
  | 'manuscriptActsFieldRuntime'
  | 'manuscriptActsFieldColor'
  | 'manuscriptActsFieldColorPlaceholder'
  | 'manuscriptActsDialogCancel'
  | 'manuscriptActsDialogCreate'
  | 'manuscriptActsDialogUpdate'
  | 'manuscriptActsSuccessUpdated'
  | 'manuscriptActsSuccessCreated'
  | 'manuscriptActsSuccessDeleted'
  | 'manuscriptActsErrorSave'
  | 'manuscriptActsErrorDelete'
  | 'manuscriptActsDeleteConfirm'
  | 'manuscriptScenesTitle'
  | 'manuscriptScenesAddShort'
  | 'manuscriptScenesAddLong'
  | 'manuscriptScenesEmptyTitle'
  | 'manuscriptScenesEmptyBody'
  | 'manuscriptScenesEmptyIcon'
  | 'manuscriptScenesTableSceneNumber'
  | 'manuscriptScenesTableHeading'
  | 'manuscriptScenesTableIntExt'
  | 'manuscriptScenesTableTime'
  | 'manuscriptScenesTablePages'
  | 'manuscriptScenesTableCharacters'
  | 'manuscriptScenesTableStatus'
  | 'manuscriptScenesTableActions'
  | 'manuscriptScenesSceneLabel'
  | 'manuscriptScenesPageSuffix'
  | 'manuscriptScenesCharactersSuffix'
  | 'manuscriptCharactersTitle'
  | 'manuscriptCharactersSearchPlaceholder'
  | 'manuscriptCharactersLeadCount'
  | 'manuscriptCharactersSupportingCount'
  | 'manuscriptCharactersMinorCount'
  | 'manuscriptCharactersEmptyTitle'
  | 'manuscriptCharactersEmptyBody'
  | 'manuscriptCharactersEmptyIcon'
  | 'manuscriptCharactersAliasPrefix'
  | 'manuscriptCharactersAgeLabel'
  | 'manuscriptCharactersDialogueLabel'
  | 'manuscriptCharactersSceneLabel'
  | 'manuscriptCharactersScenesLabel'
  | 'manuscriptCharactersScenesMoreSuffix'
  | 'manuscriptCharactersDialogTitle'
  | 'manuscriptCharactersFieldAlias'
  | 'manuscriptCharactersFieldAliasPlaceholder'
  | 'manuscriptCharactersFieldAge'
  | 'manuscriptCharactersFieldAgePlaceholder'
  | 'manuscriptCharactersFieldRole'
  | 'manuscriptCharactersRoleLead'
  | 'manuscriptCharactersRoleSupporting'
  | 'manuscriptCharactersRoleMinor'
  | 'manuscriptCharactersRoleExtra'
  | 'manuscriptCharactersFieldDescription'
  | 'manuscriptCharactersFieldDescriptionPlaceholder'
  | 'manuscriptCharactersDialogCancel'
  | 'manuscriptCharactersDialogSave'
  | 'manuscriptCharactersUpdatedSuccess'
  | 'manuscriptDialogueTitle'
  | 'manuscriptDialogueAddButton'
  | 'manuscriptDialogueFilterCharacter'
  | 'manuscriptDialogueFilterScene'
  | 'manuscriptDialogueFilterAll'
  | 'manuscriptDialogueEmptyTitle'
  | 'manuscriptDialogueEmptyBody'
  | 'manuscriptDialogueEmptyIcon'
  | 'manuscriptDialogueDialogEditTitle'
  | 'manuscriptDialogueDialogNewTitle'
  | 'manuscriptDialogueFieldCharacter'
  | 'manuscriptDialogueFieldCharacterPlaceholder'
  | 'manuscriptDialogueFieldCharacterHelper'
  | 'manuscriptDialogueFieldScene'
  | 'manuscriptDialogueFieldDialogue'
  | 'manuscriptDialogueFieldDialoguePlaceholder'
  | 'manuscriptDialogueFieldParenthetical'
  | 'manuscriptDialogueFieldParentheticalPlaceholder'
  | 'manuscriptDialogueFieldParentheticalHelper'
  | 'manuscriptDialogueFieldEmotion'
  | 'manuscriptDialogueEmotionNone'
  | 'manuscriptDialogueEmotionNeutral'
  | 'manuscriptDialogueEmotionHappy'
  | 'manuscriptDialogueEmotionSad'
  | 'manuscriptDialogueEmotionAngry'
  | 'manuscriptDialogueEmotionFrightened'
  | 'manuscriptDialogueEmotionSurprised'
  | 'manuscriptDialogueEmotionConfused'
  | 'manuscriptDialogueEmotionDetermined'
  | 'manuscriptDialogueEmotionHopeful'
  | 'manuscriptDialogueEmotionDesperate'
  | 'manuscriptDialogueEmotionWistful'
  | 'manuscriptDialogueEmotionMysterious'
  | 'manuscriptDialogueDialogCancel'
  | 'manuscriptDialogueDialogCreate'
  | 'manuscriptDialogueDialogUpdate'
  | 'manuscriptDialogueDeleteConfirm'
  | 'manuscriptDialogueSuccessCreated'
  | 'manuscriptDialogueSuccessUpdated'
  | 'manuscriptDialogueSuccessDeleted'
  | 'manuscriptDialogueErrorSave'
  | 'manuscriptDialogueErrorDelete'
  | 'manuscriptBreakdownTitle'
  | 'manuscriptBreakdownTotalScenes'
  | 'manuscriptBreakdownIntScenes'
  | 'manuscriptBreakdownExtScenes'
  | 'manuscriptBreakdownDayNight'
  | 'manuscriptBreakdownSceneHeader'
  | 'manuscriptBreakdownLocationHeader'
  | 'manuscriptBreakdownCharactersHeader'
  | 'manuscriptBreakdownPropsHeader'
  | 'manuscriptBreakdownSpecialNotesHeader'
  | 'manuscriptBreakdownVfx'
  | 'manuscriptBreakdownStunts'
  | 'manuscriptBreakdownVehicles'
  | 'manuscriptBreakdownCharsSuffix'
  | 'manuscriptBreakdownPropsSuffix'
  | 'manuscriptRevisionsTitleShort'
  | 'manuscriptRevisionsTitleLong'
  | 'manuscriptRevisionsNewShort'
  | 'manuscriptRevisionsNewLong'
  | 'manuscriptRevisionsEmptyTitle'
  | 'manuscriptRevisionsEmptyBodyShort'
  | 'manuscriptRevisionsEmptyBodyLong'
  | 'manuscriptRevisionsEmptyIcon'
  | 'manuscriptRevisionsHistoryTitle'
  | 'manuscriptRevisionsNoDescription'
  | 'manuscriptRevisionsRestoreTooltip'
  | 'manuscriptRevisionsDeleteTooltip'
  | 'manuscriptRevisionsDeleteConfirm'
  | 'manuscriptRevisionsDeleteError'
  | 'manuscriptRevisionsRestoreConfirm'
  | 'manuscriptRevisionsRestoredSuccess'
  | 'manuscriptRevisionsDeletedSuccess'
  | 'manuscriptRevisionsCreateDialogTitle'
  | 'manuscriptRevisionsCreateInfoShort'
  | 'manuscriptRevisionsCreateInfoLong'
  | 'manuscriptRevisionsNameLabel'
  | 'manuscriptRevisionsNamePlaceholder'
  | 'manuscriptRevisionsNotesLabel'
  | 'manuscriptRevisionsNotesPlaceholder'
  | 'manuscriptRevisionsCurrentVersionLabel'
  | 'manuscriptRevisionsNewVersionLabel'
  | 'manuscriptRevisionsSaveShort'
  | 'manuscriptRevisionsSaveLong'
  | 'manuscriptRevisionsNameRequiredError'
  | 'manuscriptRevisionsCreateError'
  | 'manuscriptRevisionsCreatedSuccess'
  | 'storyArcLogicTitle'
  | 'storyArcLogicSubtitle'
  | 'storyLogicSystemTitle'
  | 'storyLogicSystemSubtitle'
  | 'storyLogicUnlock'
  | 'storyLogicLock'
  | 'storyLogicReset'
  | 'storyLogicResetConfirm'
  | 'storyLogicSave'
  | 'storyLogicOverall'
  | 'storyLogicLastSaved'
  | 'storyLogicConceptLabel'
  | 'storyLogicLoglineLabel'
  | 'storyLogicThemeLabel'
  | 'storyLogicPhaseConcept'
  | 'storyLogicPhaseConceptPurpose'
  | 'storyLogicCorePremiseLabel'
  | 'storyLogicCorePremisePlaceholder'
  | 'storyLogicPrimaryGenreLabel'
  | 'storyLogicSubGenreLabel'
  | 'storyLogicToneLabel'
  | 'storyLogicTargetAudienceLabel'
  | 'storyLogicTargetAudiencePlaceholder'
  | 'storyLogicAudienceAgeLabel'
  | 'storyLogicWhyNowLabel'
  | 'storyLogicWhyNowPlaceholder'
  | 'storyLogicUniqueAngleLabel'
  | 'storyLogicUniqueAnglePlaceholder'
  | 'storyLogicMarketComparablesLabel'
  | 'storyLogicMarketComparablesPlaceholder'
  | 'storyLogicValidationConceptTitle'
  | 'storyLogicPhaseLoglineTitle'
  | 'storyLogicPhaseLoglinePurpose'
  | 'storyLogicLoglineFormulaTitle'
  | 'storyLogicLoglineFormulaBody'
  | 'storyLogicProtagonistLabel'
  | 'storyLogicProtagonistPlaceholder'
  | 'storyLogicProtagonistTraitLabel'
  | 'storyLogicProtagonistTraitPlaceholder'
  | 'storyLogicGoalLabel'
  | 'storyLogicGoalPlaceholder'
  | 'storyLogicAntagonistLabel'
  | 'storyLogicAntagonistPlaceholder'
  | 'storyLogicStakesLabel'
  | 'storyLogicStakesPlaceholder'
  | 'storyLogicGenerateLogline'
  | 'storyLogicCompleteLoglineLabel'
  | 'storyLogicCompleteLoglinePlaceholder'
  | 'storyLogicWordCountLabel'
  | 'storyLogicStrengthLabel'
  | 'storyLogicValidationLoglineTitle'
  | 'storyLogicPhaseThemeTitle'
  | 'storyLogicPhaseThemePurpose'
  | 'storyLogicCentralThemeLabel'
  | 'storyLogicCentralThemePlaceholder'
  | 'storyLogicMoralArgumentLabel'
  | 'storyLogicMoralArgumentPlaceholder'
  | 'storyLogicThemeStatementLabel'
  | 'storyLogicThemeStatementPlaceholder'
  | 'storyLogicCharacterTransformationTitle'
  | 'storyLogicProtagonistFlawLabel'
  | 'storyLogicProtagonistFlawPlaceholder'
  | 'storyLogicFlawOriginLabel'
  | 'storyLogicFlawOriginPlaceholder'
  | 'storyLogicWhatMustChangeLabel'
  | 'storyLogicWhatMustChangePlaceholder'
  | 'storyLogicTransformationArcLabel'
  | 'storyLogicTransformationArcPlaceholder'
  | 'storyLogicEmotionalJourneyLabel'
  | 'storyLogicEmotionalArcLabel'
  | 'storyLogicValidationThemeTitle'
  | 'storyLogicSummaryReadyTitle'
  | 'storyLogicSummaryReadyBody'
  | 'storyLogicSummaryTitle'
  | 'storyLogicSummaryGenreLabel'
  | 'storyLogicSummaryToneLabel'
  | 'storyLogicSummaryThemeLabel'
  | 'storyLogicPhaseLabel'
  | 'storyLogicStatusIncomplete'
  | 'storyLogicStatusWeak'
  | 'storyLogicStatusReady'
  | 'storyLogicValidationSuffix'
  | 'storyLogicLoglineWhen'
  | 'storyLogicLoglineArticle'
  | 'storyLogicLoglineMust'
  | 'storyLogicLoglineFaces'
  | 'storyLogicLoglineOrElse'
  | 'storyLogicConceptSuggestionCorePremiseExpand'
  | 'storyLogicConceptWarningCorePremiseShort'
  | 'storyLogicConceptWarningPrimaryGenre'
  | 'storyLogicConceptSuggestionToneNarrow'
  | 'storyLogicConceptWarningToneMissing'
  | 'storyLogicConceptWarningTargetAudience'
  | 'storyLogicConceptSuggestionWhyNowExpand'
  | 'storyLogicConceptWarningWhyNowMissing'
  | 'storyLogicConceptWarningUniqueAngle'
  | 'storyLogicConceptSuggestionComparables'
  | 'storyLogicLoglineWarningProtagonist'
  | 'storyLogicLoglineWarningGoal'
  | 'storyLogicLoglineWarningAntagonist'
  | 'storyLogicLoglineWarningStakes'
  | 'storyLogicLoglineSuggestionWhenStart'
  | 'storyLogicLoglineSuggestionMustInclude'
  | 'storyLogicLoglineSuggestionAddStakes'
  | 'storyLogicLoglineWarningComplete'
  | 'storyLogicThemeWarningCentralTheme'
  | 'storyLogicThemeSuggestionThemeStatementFormat'
  | 'storyLogicThemeWarningThemeStatement'
  | 'storyLogicThemeWarningProtagonistFlaw'
  | 'storyLogicThemeWarningMustChange'
  | 'storyLogicThemeWarningTransformationArc'
  | 'storyLogicThemeSuggestionEmotionalBeats'
  | 'storyLogicGenreDrama'
  | 'storyLogicGenreComedy'
  | 'storyLogicGenreAction'
  | 'storyLogicGenreThriller'
  | 'storyLogicGenreHorror'
  | 'storyLogicGenreSciFi'
  | 'storyLogicGenreFantasy'
  | 'storyLogicGenreRomance'
  | 'storyLogicGenreMystery'
  | 'storyLogicGenreCrime'
  | 'storyLogicGenreDocumentary'
  | 'storyLogicGenreAnimation'
  | 'storyLogicGenreMusical'
  | 'storyLogicGenreWestern'
  | 'storyLogicGenreWar'
  | 'storyLogicGenreBiography'
  | 'storyLogicSubGenreDramaFamily'
  | 'storyLogicSubGenreDramaLegal'
  | 'storyLogicSubGenreDramaMedical'
  | 'storyLogicSubGenreDramaPolitical'
  | 'storyLogicSubGenreDramaSports'
  | 'storyLogicSubGenreComedyRomantic'
  | 'storyLogicSubGenreComedyDark'
  | 'storyLogicSubGenreComedySatire'
  | 'storyLogicSubGenreComedySlapstick'
  | 'storyLogicSubGenreComedyParody'
  | 'storyLogicSubGenreActionMartialArts'
  | 'storyLogicSubGenreActionSpy'
  | 'storyLogicSubGenreActionHeist'
  | 'storyLogicSubGenreActionDisaster'
  | 'storyLogicSubGenreActionSuperhero'
  | 'storyLogicSubGenreThrillerPsychological'
  | 'storyLogicSubGenreThrillerPolitical'
  | 'storyLogicSubGenreThrillerLegal'
  | 'storyLogicSubGenreThrillerTechno'
  | 'storyLogicSubGenreThrillerConspiracy'
  | 'storyLogicSubGenreHorrorSupernatural'
  | 'storyLogicSubGenreHorrorSlasher'
  | 'storyLogicSubGenreHorrorPsychological'
  | 'storyLogicSubGenreHorrorBody'
  | 'storyLogicSubGenreHorrorFoundFootage'
  | 'storyLogicSubGenreSciFiSpaceOpera'
  | 'storyLogicSubGenreSciFiCyberpunk'
  | 'storyLogicSubGenreSciFiPostApocalyptic'
  | 'storyLogicSubGenreSciFiTimeTravel'
  | 'storyLogicSubGenreSciFiAlienInvasion'
  | 'storyLogicSubGenreFantasyEpic'
  | 'storyLogicSubGenreFantasyUrban'
  | 'storyLogicSubGenreFantasyDark'
  | 'storyLogicSubGenreFantasyFairyTale'
  | 'storyLogicSubGenreFantasyMythological'
  | 'storyLogicSubGenreRomancePeriod'
  | 'storyLogicSubGenreRomanceContemporary'
  | 'storyLogicSubGenreRomanceParanormal'
  | 'storyLogicSubGenreRomanceTragic'
  | 'storyLogicSubGenreMysteryWhodunit'
  | 'storyLogicSubGenreMysteryNoir'
  | 'storyLogicSubGenreMysteryCozy'
  | 'storyLogicSubGenreMysteryProcedural'
  | 'storyLogicSubGenreCrimeGangster'
  | 'storyLogicSubGenreCrimeHeist'
  | 'storyLogicSubGenreCrimeTrueCrime'
  | 'storyLogicSubGenreCrimeNeoNoir'
  | 'storyLogicToneDark'
  | 'storyLogicToneLight'
  | 'storyLogicToneSerious'
  | 'storyLogicToneComedic'
  | 'storyLogicToneSuspenseful'
  | 'storyLogicToneHopeful'
  | 'storyLogicToneMelancholic'
  | 'storyLogicToneSatirical'
  | 'storyLogicToneGritty'
  | 'storyLogicToneWhimsical'
  | 'storyLogicToneIntense'
  | 'storyLogicToneRomantic'
  | 'storyLogicToneCynical'
  | 'storyLogicToneInspirational'
  | 'storyLogicToneSurreal'
  | 'storyLogicToneNostalgic'
  | 'storyLogicAudienceChildrenUnder12'
  | 'storyLogicAudienceTeen13To17'
  | 'storyLogicAudienceYoungAdult18To25'
  | 'storyLogicAudienceAdult26To45'
  | 'storyLogicAudienceMatureAdult46To65'
  | 'storyLogicAudienceSenior65Plus'
  | 'storyLogicAudienceAllAges'
  | 'storyLogicEmotionHope'
  | 'storyLogicEmotionFear'
  | 'storyLogicEmotionJoy'
  | 'storyLogicEmotionSadness'
  | 'storyLogicEmotionAnger'
  | 'storyLogicEmotionSurprise'
  | 'storyLogicEmotionDisgust'
  | 'storyLogicEmotionTrust'
  | 'storyLogicEmotionAnticipation'
  | 'storyLogicEmotionLove'
  | 'storyLogicEmotionShame'
  | 'storyLogicEmotionPride'
  | 'storyLogicEmotionGuilt'
  | 'storyLogicEmotionRelief'
  | 'storyLogicEmotionDespair'
  | 'storyLogicEmotionTriumph'
  | 'templatePanelTitle'
  | 'templateSearchPlaceholder'
  | 'templateTabAll'
  | 'templateTabMine'
  | 'templateTabRecent'
  | 'templateTabStructures'
  | 'templateEmpty'
  | 'templateStoryBeatsLabel'
  | 'templatePagesLabel'
  | 'templateBeatPagePrefix'
  | 'templateDeleteConfirm'
  | 'templatePreviewTooltip'
  | 'templateApplyTooltip'
  | 'templatePreviewClose'
  | 'templatePreviewApply'
  | 'productionReadLabel'
  | 'productionReadShort'
  | 'productionReadThrough'
  | 'productionReadThroughShort'
  | 'productionManuscriptLabel'
  | 'productionManuscriptShort'
  | 'productionSceneLabel'
  | 'productionLineLabel'
  | 'productionOfLabel'
  | 'productionZoomIn'
  | 'productionZoomOut'
  | 'productionHeaderShort'
  | 'productionHeaderLong'
  | 'productionShortcutsTitle'
  | 'productionShortcutsLabel'
  | 'productionShortcutPlayPause'
  | 'productionShortcutNavigate'
  | 'productionShortcutUndo'
  | 'productionShortcutRedo'
  | 'productionShortcutSelectAll'
  | 'productionShortcutDelete'
  | 'productionShortcutClear'
  | 'productionReadThroughStart'
  | 'productionReadThroughStop'
  | 'productionTalentShow'
  | 'productionTalentHide'
  | 'productionQuickNotesTooltip'
  | 'productionDuplicateSceneTooltip'
  | 'productionSaveTemplateTooltip'
  | 'productionExportPdfTooltip'
  | 'productionCallSheetTooltip'
  | 'productionStripboardTooltip'
  | 'productionShootingDayPlannerTooltip'
  | 'productionLiveSetTooltip'
  | 'productionLiveSetConnectTooltip'
  | 'productionLiveSetDisconnectTooltip'
  | 'productionSearchPlaceholder'
  | 'productionFiltersLabel'
  | 'productionScenesLabel'
  | 'productionScenesLabelLower'
  | 'productionScenesShortLabel'
  | 'productionShotsLabel'
  | 'productionShotsLabelLower'
  | 'productionShotsLabelUpper'
  | 'productionCameraLabel'
  | 'productionCameraLabelUpper'
  | 'productionLightLabelUpper'
  | 'productionSoundLabelUpper'
  | 'productionLightLabel'
  | 'productionSoundLabel'
  | 'productionTagsLabel'
  | 'productionProgressLabel'
  | 'productionCompleteLabel'
  | 'productionTotalLabel'
  | 'productionSortNumber'
  | 'productionSortDuration'
  | 'productionSortDate'
  | 'productionSortName'
  | 'productionSortAscending'
  | 'productionSortDescending'
  | 'productionSortByLabel'
  | 'productionSortOptionNumber'
  | 'productionSortOptionDuration'
  | 'productionSortOptionDate'
  | 'productionSortOptionName'
  | 'productionActLabel'
  | 'productionVisibleLabel'
  | 'productionBatchScenesSelected'
  | 'productionBatchSceneSelected'
  | 'productionBatchExportTooltip'
  | 'productionBatchDeleteTooltip'
  | 'productionBatchClearTooltip'
  | 'productionBatchDeleteConfirmPrefix'
  | 'productionBatchDeleteConfirmSuffix'
  | 'productionAddSceneTooltip'
  | 'productionNewSceneLabel'
  | 'productionNewSceneDialogTitle'
  | 'productionNewSceneDialogBody'
  | 'productionNewSceneDialogAction'
  | 'productionNewSceneHeadingDefault'
  | 'productionNewSceneLocationDefault'
  | 'productionNewSceneIntDefault'
  | 'productionNewSceneTimeDefault'
  | 'productionDeleteSceneTitle'
  | 'productionDeleteSceneBody'
  | 'productionDeleteSceneAction'
  | 'productionExportProductionTooltip'
  | 'productionSceneBadgeLabel'
  | 'productionInteriorLabel'
  | 'productionExteriorLabel'
  | 'productionQuickActionsLabel'
  | 'productionNeedsTooltip'
  | 'productionNeedsButton'
  | 'productionScheduleTooltip'
  | 'productionScheduleButton'
  | 'productionChecklistTooltip'
  | 'productionChecklistButton'
  | 'productionBulkShotsTooltip'
  | 'productionBulkShotsButton'
  | 'productionLineCoverageTooltip'
  | 'productionLineCoverageButton'
  | 'productionSyncStatusTooltip'
  | 'productionSyncStatusButton'
  | 'productionReferenceImageLabel'
  | 'productionReferenceFromCasting'
  | 'productionDialogueLabel'
  | 'productionDialogueLinesLabel'
  | 'productionDialogueLinesTitle'
  | 'productionNoDialogueLabel'
  | 'productionReadThroughNotesLabel'
  | 'productionProductionNotesLabel'
  | 'productionAddNoteTooltip'
  | 'productionReadThroughPlaceholder'
  | 'productionCameraNoteLabel'
  | 'productionCameraNoteEditPlaceholder'
  | 'productionCameraNotePlaceholder'
  | 'productionDirectorNoteLabel'
  | 'productionDirectorNoteEditPlaceholder'
  | 'productionDirectorNotePlaceholder'
  | 'productionStatusLabel'
  | 'productionStatusNotStarted'
  | 'productionStatusInProgress'
  | 'productionStatusComplete'
  | 'productionStoryboardShotsLabel'
  | 'productionAddShotTooltip'
  | 'productionNoShotsLabel'
  | 'productionAddFirstShotLabel'
  | 'productionSelectSceneTitle'
  | 'productionSelectSceneBody'
  | 'productionTimelineLabel'
  | 'productionTimelinePause'
  | 'productionTimelinePlay'
  | 'productionTimelineZoomIn'
  | 'productionTimelineZoomOut'
  | 'productionOvertimeLabel'
  | 'productionGridView'
  | 'productionGridViewActive'
  | 'productionListView'
  | 'productionListViewActive'
  | 'productionAudioLabel'
  | 'productionVideoLabel'
  | 'productionActiveSceneLabel'
  | 'productionSceneFallback'
  | 'productionIntFallback'
  | 'productionLocationFallback'
  | 'productionTimeFallback'
  | 'productionShotLabel'
  | 'productionShotFallbackType'
  | 'productionShotTypeWide'
  | 'productionShotTypeCloseUp'
  | 'productionShotTypeMedium'
  | 'productionShotTypeExtremeCloseUp'
  | 'productionShotTypeEstablishing'
  | 'productionShotTypeDetail'
  | 'productionShotTypeTwoShot'
  | 'productionShotTypeOverShoulder'
  | 'productionShotTypePOV'
  | 'productionShotTypeInsert'
  | 'productionNewShotDescriptionDefault'
  | 'productionShotInspectorLabel'
  | 'productionShotDetailsFallback'
  | 'productionCameraSectionLabel'
  | 'productionLensLabel'
  | 'productionMovementLabel'
  | 'productionFramingLabel'
  | 'productionNotSetLabel'
  | 'productionLightingSectionLabel'
  | 'productionKeyLightLabel'
  | 'productionTemperatureLabel'
  | 'productionRatioLabel'
  | 'productionSoundSectionLabel'
  | 'productionMicLabel'
  | 'productionAmbienceLabel'
  | 'productionNotesLabel'
  | 'productionCameraEquipmentLabel'
  | 'productionSyncedTooltip'
  | 'productionSyncedLabel'
  | 'productionInventoryLabel'
  | 'productionStandardLabel'
  | 'productionLensLabelUpper'
  | 'productionRigLabel'
  | 'productionShotTypeLabel'
  | 'productionShotListLabel'
  | 'productionCopySettingsTooltip'
  | 'productionSavePresetTooltip'
  | 'productionReferencesLabel'
  | 'productionReferencesUploadedSuffix'
  | 'productionReferencesSources'
  | 'productionReferencesUploadedLabel'
  | 'productionReferenceUploadedSource'
  | 'productionReferenceTitlePrefix'
  | 'productionCenterPanelLabel'
  | 'productionUploadLabel'
  | 'productionSearchReferencesLabel'
  | 'productionReferenceSearchTitle'
  | 'productionReferenceSearchBack'
  | 'productionReferenceSearchPlaceholder'
  | 'productionSearchLabel'
  | 'productionSourceAllLabel'
  | 'productionSourceShotCafeLabel'
  | 'productionSourceUnsplashLabel'
  | 'productionReferenceSearchLoading'
  | 'productionReferenceQuerySceneFallback'
  | 'productionReferenceQueryDayFallback'
  | 'productionReferenceQuerySuffix'
  | 'productionReferenceAttributionDemoImage'
  | 'productionReferenceAttributionReferenceImage'
  | 'productionDefaultCamera'
  | 'productionDefaultLens'
  | 'productionDefaultRig'
  | 'productionDefaultShotType'
  | 'productionDefaultKeyLight'
  | 'productionDefaultSideLight'
  | 'productionDefaultGel'
  | 'productionDefaultMic'
  | 'productionDefaultAtmos'
  | 'productionCameraAngleEyeLevel'
  | 'productionLensOption50mmPrime'
  | 'productionLensOption35mmPrime'
  | 'productionLensOption85mmPrime'
  | 'productionLensOption24_70Zoom'
  | 'productionLensOption70_200Zoom'
  | 'productionLensOption16mmWide'
  | 'productionLensOption100mmMacro'
  | 'productionRigOptionTripod'
  | 'productionRigOptionSteadicam'
  | 'productionRigOptionGimbal'
  | 'productionRigOptionHandheld'
  | 'productionRigOptionDolly'
  | 'productionRigOptionCrane'
  | 'productionRigOptionDrone'
  | 'productionRigOptionShoulderRig'
  | 'productionRigOptionSlider'
  | 'productionKeyLightOptionSoftSide'
  | 'productionKeyLightOptionKeyLight1200'
  | 'productionKeyLightOptionKeyLight600'
  | 'productionKeyLightOptionSoftbox'
  | 'productionKeyLightOptionLedPanel'
  | 'productionKeyLightOptionHmi'
  | 'productionKeyLightOptionNatural'
  | 'productionSideLightOptionWarmTone'
  | 'productionSideLightOptionSideLighting'
  | 'productionSideLightOptionFillLight'
  | 'productionSideLightOptionRimLight'
  | 'productionSideLightOptionBackLight'
  | 'productionSideLightOptionPractical'
  | 'productionSideLightOptionNatural'
  | 'productionGelOptionWarmQuarterCto'
  | 'productionGelOptionWarmHalfCto'
  | 'productionGelOptionFullCto'
  | 'productionGelOptionQuarterCtb'
  | 'productionGelOptionHalfCtb'
  | 'productionGelOptionNone'
  | 'productionMicOptionBoom'
  | 'productionMicOptionLav'
  | 'productionMicOptionShotgun'
  | 'productionMicOptionWirelessLav'
  | 'productionMicOptionPlant'
  | 'productionAtmosOptionRoomTone'
  | 'productionAtmosOptionQuiet'
  | 'productionAtmosOptionNatural'
  | 'productionAtmosOptionCityTraffic'
  | 'productionAtmosOptionNature'
  | 'productionAtmosOptionInterior'
  | 'productionCameraSonyFx6'
  | 'productionCameraSonyFx3'
  | 'productionCameraSonyA7s3'
  | 'productionCameraSonyVenice2'
  | 'productionCameraRedKomodo'
  | 'productionCameraRedVRaptor'
  | 'productionCameraArriAlexaMiniLf'
  | 'productionCameraArriAlexa35'
  | 'productionCameraBlackmagicUrsaMiniPro'
  | 'productionCameraCanonC70'
  | 'productionCameraCanonR5c'
  | 'productionCameraPanasonicS1h'
  | 'productionLensDefault50mmPrime'
  | 'productionLensDefault35mmPrime'
  | 'productionLensDefault85mmPrime'
  | 'productionLensDefault2470mm'
  | 'productionMovementStatic'
  | 'productionMovementSlowPushIn'
  | 'productionMovementDolly'
  | 'productionMovementPan'
  | 'productionFramingWide'
  | 'productionFramingMedium'
  | 'productionFramingCloseUp'
  | 'productionFramingExtremeCloseUp'
  | 'productionLightingKeySoftSide'
  | 'productionLightingKey4ft'
  | 'productionLightingKeyBacklightOnly'
  | 'productionLightingKeyRingLight'
  | 'productionLightingTemp3200k'
  | 'productionLightingTemp5600k'
  | 'productionLightingTemp4300k'
  | 'productionLightingRatio3to1'
  | 'productionLightingRatio2to1'
  | 'productionLightingRatio4to1'
  | 'productionLightingRatio1_5to1'
  | 'productionSoundMicBoom'
  | 'productionSoundMicLav'
  | 'productionSoundMicWireless'
  | 'productionSoundMicStudio'
  | 'productionSoundAmbienceQuietInterior'
  | 'productionSoundAmbienceStreetTraffic'
  | 'productionSoundAmbienceForest'
  | 'productionSoundAmbienceEmptyRoom'
  | 'productionSoundNotesMonitorLevels'
  | 'productionSoundNotesWatchWind'
  | 'productionSoundNotesAcHum'
  | 'productionSoundNotesCleanTake'
  | 'productionTimelineMarker0000'
  | 'productionTimelineMarker0030'
  | 'productionTimelineMarker0100'
  | 'productionTimelineMarker0130'
  | 'productionTimelineMarker0200'
  | 'productionTimelineMarker0230'
  | 'productionTimelineMarker0300'
  | 'productionSortAscendingSymbol'
  | 'productionSortDescendingSymbol'
  | 'productionDirectorNoteBadge'
  | 'productionBatchExportFilenamePrefix'
  | 'productionBatchExportFilenameSuffix'
  | 'productionReferenceSelectFramePrefix'
  | 'productionReferenceSelectFrameSuffix'
  | 'productionReferenceChooseAction'
  | 'productionAddToCenterPanelLabel'
  | 'productionOpenShotCafeLabel'
  | 'productionShotCafeFilmsLabel'
  | 'productionResultsLabel'
  | 'productionFramesLabel'
  | 'productionCinematographerLabel'
  | 'productionMoodImagesLabel'
  | 'productionReferenceEmptyTitle'
  | 'productionReferenceEmptyBody'
  | 'productionReferenceAttribution'
  | 'productionReferenceTagBladeRunner'
  | 'productionReferenceTagNoir'
  | 'productionReferenceTagGoldenHour'
  | 'productionReferenceTagSilhouette'
  | 'productionReferenceTagCloseUp'
  | 'productionReferenceTagWideShot'
  | 'productionReferenceTagSicario'
  | 'productionReferenceTagJoker'
  | 'productionReferenceTagDune'
  | 'productionReferenceTagTheBatman'
  | 'productionReferenceTagInterstellar'
  | 'productionReferenceTagRogerDeakins'
  | 'productionReferenceTagChivo'
  | 'productionStripboardTitlePrefix'
  | 'productionShootingDayPlannerTitlePrefix'
  | 'productionLiveSetDayTitle'
  | 'productionLiveSetDayBody'
  | 'productionDayLabel'
  | 'productionDayStatusWrapped'
  | 'productionDayStatusInProgress'
  | 'productionDayStatusPlanned'
  | 'productionCallSheetPreviewTitlePrefix'
  | 'productionCallSheetFilenamePrefix'
  | 'productionExportDialogTitle'
  | 'productionExportDialogBody'
  | 'productionExportDialogContentsLabel'
  | 'productionExportDialogEquipmentLabel'
  | 'productionExportDialogAction'
  | 'productionPdfSceneLabel'
  | 'productionPdfCharactersLabel'
  | 'productionPdfShotsLabel'
  | 'productionPdfNotesLabel'
  | 'productionPdfNoDescription'
  | 'productionPdfNoCharacters'
  | 'productionPdfNoNotes'
  | 'productionTalentPanelTitle'
  | 'productionSceneLabelUpper'
  | 'productionCharactersLabel'
  | 'productionConfirmedCastLabel'
  | 'productionInSceneLabel'
  | 'productionNoConfirmedCastTitle'
  | 'productionNoConfirmedCastBodyPrefix'
  | 'productionNoConfirmedCastBodySuffix'
  | 'productionQuickNotesTitle'
  | 'productionQuickNotesPlaceholder'
  | 'productionDoneLabel'
  | 'productionSaveTemplateTitle'
  | 'productionTemplateNameLabel'
  | 'productionTemplateNamePlaceholder'
  | 'productionAvailableTemplatesLabel'
  | 'productionNoTemplatesLabel'
  | 'productionSaveTemplateAction'
  | 'productionTagsFiltersTitle'
  | 'productionSelectedLabel'
  | 'productionSceneTagsLabel'
  | 'productionEquipmentNeedsLabel'
  | 'productionMissingCameraEquipmentLabel'
  | 'productionMissingLightingLabel'
  | 'productionMissingAudioLabel'
  | 'productionCloseLabel'
  | 'productionSavePresetDialogTitle'
  | 'productionSavePresetDialogBody'
  | 'productionSavePresetNamePlaceholder'
  | 'productionSavePresetSettingsLabel'
  | 'productionShotTypeValueLabel'
  | 'productionSavePresetAction'
  | 'productionSaveLabel'
  | 'productionExitFullscreen'
  | 'productionEnterFullscreen'
  | 'productionCancelLabel'
  | 'productionAddNoteTitle'
  | 'productionAddNoteBodyPrefix'
  | 'productionAddNoteTypeLabel'
  | 'productionDirectorLabel'
  | 'productionVfxLabel'
  | 'productionAddNotePlaceholder'
  | 'productionAddLabel'
  | 'productionAddShotDialogTitle'
  | 'productionBackLabel'
  | 'productionAddShotModeLabel'
  | 'productionAddShotUploadTitle'
  | 'productionAddShotUploadBody'
  | 'productionAddShotReferenceTitle'
  | 'productionAddShotReferenceBody'
  | 'productionAddShotUploadPrompt'
  | 'productionAddShotChooseAnother'
  | 'productionAddShotPickImage'
  | 'productionAddShotFormats'
  | 'productionAddShotReferencePrompt'
  | 'productionAddShotSearchPlaceholder'
  | 'productionAddShotWithImage'
  | 'productionAddShotWithoutImage'
  | 'productionSceneNeedsTitle'
  | 'productionSceneNeedsBody'
  | 'productionSceneNeedsCameraDetail'
  | 'productionSceneNeedsLightDetail'
  | 'productionSceneNeedsSoundDetail'
  | 'productionScheduleDialogTitle'
  | 'productionScheduleDialogBody'
  | 'productionScheduleRemoveLabel'
  | 'productionChecklistDialogTitle'
  | 'productionChecklistReadyLabel'
  | 'productionChecklistStatusLabel'
  | 'productionChecklistProgressLabel'
  | 'productionChecklistLocation'
  | 'productionChecklistCast'
  | 'productionChecklistProps'
  | 'productionChecklistEquipment'
  | 'productionChecklistPermits'
  | 'productionChecklistScript'
  | 'productionBulkShotTitle'
  | 'productionBulkShotBody'
  | 'productionBulkTemplateStandardTitle'
  | 'productionBulkTemplateStandardDescription'
  | 'productionShotTemplateStandard1'
  | 'productionShotTemplateStandard2'
  | 'productionShotTemplateStandard3'
  | 'productionBulkTemplateDialogueTitle'
  | 'productionBulkTemplateDialogueDescription'
  | 'productionShotTemplateDialogue1'
  | 'productionShotTemplateDialogue2'
  | 'productionShotTemplateDialogue3'
  | 'productionShotTemplateDialogue4'
  | 'productionShotTemplateDialogue5'
  | 'productionShotTemplateDialogue6'
  | 'productionBulkTemplateActionTitle'
  | 'productionBulkTemplateActionDescription'
  | 'productionShotTemplateAction1'
  | 'productionShotTemplateAction2'
  | 'productionShotTemplateAction3'
  | 'productionShotTemplateAction4'
  | 'productionShotTemplateAction5'
  | 'productionShotTemplateAction6'
  | 'productionBulkShotsCreatedLabel'
  | 'productionBulkShotsAction'
  | 'productionLineCoverageTitle'
  | 'productionLineCoverageBody'
  | 'productionLinesCoveredLabel'
  | 'productionCoveredByLabel'
  | 'productionUncoveredDialogueLabel'
  | 'productionSceneExistsPrefix'
  | 'productionSceneExistsSuffix'
  | 'productionSceneNumberValidation'
  | 'storyArcStudio'
  | 'storyArcTagline'
  | 'storyLogicChip'
  | 'storyWriterTitle'
  | 'storyWriterSubtitle'
  | 'storyWriterChip'
  | 'storyLogicHeader'
  | 'storyWriterHeader';

export type BrandingIdentity = {
  appName: string;
  tagline: string;
  domain: string;
  supportEmail: string;
  docsUrl: string;
  logoUrl: string;
  iconUrl: string;
  faviconUrl: string;
  emailLogoUrl: string;
  landingHeroImageUrl: string;
  watermarkUrl: string;
};

export type BrandingColors = {
  primary: string;
  secondary: string;
  accent: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  gradientStart: string;
  gradientEnd: string;
};

export type BrandingTypography = {
  headingFont: string;
  bodyFont: string;
  monoFont: string;
  baseFontSize: number;
  headingWeight: number;
  bodyWeight: number;
  letterSpacing: number;
};

export type BrandingLayout = {
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  shadowSoft: string;
  shadowStrong: string;
  buttonRadius: number;
  inputRadius: number;
  cardRadius: number;
};

export type BrandingTokens = {
  labels: Record<BrandingTextTokenKey, string>;
};

export type BrandingSettings = {
  version: number;
  identity: BrandingIdentity;
  colors: BrandingColors;
  typography: BrandingTypography;
  layout: BrandingLayout;
  tokens: BrandingTokens;
} & BrandingIdentity;

const DEFAULT_IDENTITY: BrandingIdentity = {
  appName: 'The Role Room',
  tagline: 'Casting. Roles. Together',
  domain: 'theroleroom.com',
  supportEmail: 'support@theroleroom.com',
  docsUrl: 'https://docs.theroleroom.com',
  logoUrl: '/TheRoleRoom_Logo_Tagline.png',
  iconUrl: '/TheRoleRoom_Logo_Tagline.png',
  faviconUrl: '/TheRoleRoom_Logo_Tagline.png',
  emailLogoUrl: '/TheRoleRoom_Logo_Tagline.png',
  landingHeroImageUrl: '/TheRoleRoom_Logo_Tagline.png',
  watermarkUrl: '/TheRoleRoom_Logo_Tagline.png',
};

const DEFAULT_COLORS: BrandingColors = {
  primary: '#8b5cf6',
  secondary: '#6366f1',
  accent: '#00d4ff',
  info: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  background: '#0a0a0f',
  surface: '#0d1117',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.87)',
  border: 'rgba(139,92,246,0.3)',
  gradientStart: '#8b5cf6',
  gradientEnd: '#6366f1',
};

const DEFAULT_TYPOGRAPHY: BrandingTypography = {
  headingFont: 'Poppins, "SF Pro Display", "Segoe UI", sans-serif',
  bodyFont: 'Inter, "SF Pro Text", "Segoe UI", sans-serif',
  monoFont: 'JetBrains Mono, Menlo, Consolas, monospace',
  baseFontSize: 16,
  headingWeight: 700,
  bodyWeight: 400,
  letterSpacing: 0.2,
};

const DEFAULT_LAYOUT: BrandingLayout = {
  radiusSm: 6,
  radiusMd: 12,
  radiusLg: 20,
  shadowSoft: '0 8px 24px rgba(0,0,0,0.25)',
  shadowStrong: '0 24px 60px rgba(0,0,0,0.45)',
  buttonRadius: 12,
  inputRadius: 10,
  cardRadius: 16,
};

const DEFAULT_TOKENS: BrandingTokens = {
  labels: {
    casting: 'Casting',
    roles: 'Roller',
    candidates: 'Kandidater',
    auditions: 'Auditions',
    team: 'Team',
    locations: 'Steder',
    equipment: 'Utstyr',
    schedule: 'Kalender',
    shotList: 'Shot List',
    callSheets: 'Call Sheets',
    projects: 'Prosjekter',
    dashboard: 'Oversikt',
    storyboard: 'Storyboard',
    sharing: 'Deling',
    crewCalendar: 'Crew Kalender',
    overviewDescription: 'Opprett nytt casting prosjekt',
    newProjectTitle: 'Nytt prosjekt',
    teamDescription: 'Administrer crew og teammedlemmer',
    locationsDescription: 'Administrer lokasjoner og steder',
    equipmentDescription: 'Administrer rekvisitter og utstyr',
    scheduleDescription: 'Administrer kalender og timeplan',
    scheduleProductionLabel: 'Produksjonsplan',
    shotListDescriptionPhoto: 'Fotolister og komposisjoner',
    shotListDescriptionVideo: 'Videolister og scener',
    sharingDescription: 'Administrer delingsinnstillinger',
    noProjectSelected: 'Ingen prosjekt valgt',
    noAccessTeam: 'Du har ikke tilgang til å administrere teamet',
    noAccessLocations: 'Du har ikke tilgang til å administrere lokasjoner',
    noAccessEquipment: 'Du har ikke tilgang til å administrere utstyr',
    noAccessSchedule: 'Du har ikke tilgang til å redigere produksjonsplanen',
    noAccessShotList: 'Du har ikke tilgang til å redigere shot lists',
    noAccessSharing: 'Du har ikke tilgang til delingsinnstillinger',
    mustCreateProject: 'Du må opprette et prosjekt først',
    needCandidateAndRole: 'Du må ha minst én kandidat og én rolle før du kan opprette timeplan',
    assignedRolesLabel: 'Tildelte roller',
    consentSignedLabel: 'samtykker signert',
    unknownRoleLabel: 'Ukjent rolle',
    roleOwnerLabel: 'Eier',
    roleAdminLabel: 'Administrator',
    roleDirectorLabel: 'Regissør',
    roleProducerLabel: 'Produsent',
    roleCastingDirectorLabel: 'Castingansvarlig',
    roleProductionManagerLabel: 'Produsentleder',
    roleCameraTeamLabel: 'Kamerateam',
    roleAgencyLabel: 'Byrå',
    roleNameRequired: 'Rolle må ha et navn',
    roleSaveError: 'Feil ved lagring av rolle',
    confirmDeleteRole: 'Er du sikker på at du vil slette denne rollen?',
    roleDeleteError: 'Feil ved sletting av rolle',
    roleDeleteSuccess: 'Rolle slettet',
    candidateNameRequired: 'Kandidat må ha et navn',
    candidateSaveError: 'Feil ved lagring av kandidat',
    confirmDeleteCandidate: 'Er du sikker på at du vil slette denne kandidaten?',
    candidateDeleteError: 'Feil ved sletting av kandidat',
    scheduleSaveError: 'Feil ved lagring av timeplan',
    confirmDeleteSchedule: 'Er du sikker på at du vil slette denne timeplanen?',
    scheduleDeleteError: 'Feil ved sletting av timeplan',
    scheduleLabel: 'Timeplan',
    removeUserLabel: 'Fjern bruker',
    confirmRemoveUserLabel: 'Er du sikker på at du vil fjerne denne brukeren?',
    removeUserErrorLabel: 'Feil ved fjerning av bruker',
    activeProjectLabel: 'Aktivt prosjekt',
    editProjectAriaLabel: 'Rediger {project}',
    editProjectLabel: 'Rediger prosjekt',
    confirmDeleteProjectWithWarning: 'Er du sikker på at du vil slette prosjektet "{project}"? Denne handlingen kan ikke angres.',
    projectDeleteError: 'Kunne ikke slette prosjektet. Prøv igjen.',
    deleteProjectAriaLabel: 'Slett {project}',
    deleteProjectLabel: 'Slett prosjekt',
    tutorialLabel: 'Veiledning',
    tutorialTitle: 'Interaktiv veiledning',
    switchProfessionLabel: 'Bytt profesjon',
    editTutorialsLabel: 'Rediger veiledninger',
    manageUsersLabel: 'Administrer brukere',
    confirmResetDemoProjects: 'Nullstill demoprosjekter? Dette vil gjenopprette standarddata.',
    demoDataResetSuccess: 'Demodata nullstilt',
    resetDemoDataLabel: 'Nullstill demodata',
    showIntroLabel: 'Vis introduksjon',
    showIntroTitle: 'Vis introduksjon på nytt',
    logoutLabel: 'Logg ut',
    loginLabel: 'Logg inn',
    rolesStatLabel: '{total} roller ({open} åpne)',
    candidatesStatLabel: '{count} kandidater',
    upcomingStatLabel: '{count} kommende',
    exitFullscreenLabel: 'Avslutt fullskjerm',
    enterFullscreenLabel: 'Fullskjerm',
    closePanelLabel: 'Lukk panel',
    loadingLabel: 'Laster...',
    searchCandidatesPlaceholder: 'Søk kandidater...',
    candidateStatusAll: 'Alle statuser',
    candidateStatusPending: 'Venter',
    candidateStatusRequested: 'Forespurt',
    candidateStatusShortlist: 'Shortlist',
    candidateStatusSelected: 'Valgt',
    candidateStatusConfirmed: 'Bekreftet',
    candidateStatusRejected: 'Avvist',
    listViewLabel: 'Listevisning',
    kanbanViewLabel: 'Kanban-visning',
    draggingCandidateLabel: 'Drar kandidat: {name}',
    cancelLabel: 'Avbryt',
    quickContactLabel: 'Hurtigkontakt:',
    emailTooltipPrefix: 'E-post: ',
    callTooltipPrefix: 'Ring: ',
    dateLabel: 'Dato',
    candidateLabel: 'Kandidat',
    roleLabel: 'Rolle',
    allCandidatesLabel: 'Alle kandidater',
    allRolesLabel: 'Alle roller',
    resetFiltersLabel: 'Nullstill filter',
    roleDialogNewTitle: 'Ny rolle',
    roleDialogEditTitle: 'Rediger rolle',
    roleBasicsSectionLabel: 'Grunnleggende',
    roleNameLabel: 'Rollenavn',
    roleDescriptionLabel: 'Beskrivelse',
    roleMinAgeLabel: 'Min alder',
    roleMaxAgeLabel: 'Maks alder',
    genderLabel: 'Kjønn',
    genderMaleLabel: 'Mann',
    genderFemaleLabel: 'Kvinne',
    genderNonBinaryLabel: 'Ikke-binær',
    genderAllLabel: 'Alle',
    statusLabel: 'Status',
    roleStatusDraft: 'Draft',
    roleStatusOpen: 'Åpen',
    roleStatusCasting: 'Casting',
    roleStatusFilled: 'Fylt',
    roleStatusCancelled: 'Avlyst',
    roleRequirementsSectionLabel: 'Krav og tilknytninger',
    roleAppearanceLabel: 'Utseende',
    roleAppearancePlaceholder: 'høyde, hårfarge...',
    roleSkillsLabel: 'Ferdigheter',
    roleSkillsPlaceholder: 'skuespill, dans...',
    roleSpecialNeedsLabel: 'Spesielle behov',
    roleSpecialNeedsPlaceholder: 'uniform, dialekt...',
    roleScenesLabel: 'Scener',
    roleCrewLabel: 'Crew',
    roleLocationsLabel: 'Lokasjoner',
    rolePropsLabel: 'Rekvisitter',
    saveRoleLabel: 'Lagre rolle',
    deleteLabel: 'Slett',
    candidateDialogNewTitle: 'Ny kandidat',
    candidateDialogEditTitle: 'Rediger kandidat',
    nameLabel: 'Navn',
    emailLabel: 'E-post',
    phoneLabel: 'Telefon',
    addressLabel: 'Adresse',
    mediaSectionLabel: 'Bilder / Video',
    uploadMediaLabel: 'Last opp bilder/video',
    candidatePhotoAltLabel: 'Kandidatbilde {index}',
    auditionNotesLabel: 'Audition-notater',
    emergencyContactSectionLabel: 'Nødskontakt',
    relationshipLabel: 'Forhold',
    consentSectionLabel: 'Samtykke',
    sendConsentOnSaveLabel: 'Send samtykkekontrakt etter lagring',
    consentSendHelpText: 'Kandidaten vil motta en invitasjon til å signere samtykkekontrakt via e-post eller SMS',
    saveLabel: 'Lagre',
    scheduleDialogNewTitle: 'Ny timeplan',
    scheduleDialogEditTitle: 'Rediger timeplan',
    timeLabel: 'Tid',
    locationLabel: 'Lokasjon',
    noLocationLabel: 'Ingen lokasjon',
    locationFallbackLabel: 'Eller skriv inn adresse',
    locationFallbackPlaceholder: 'Brukes hvis lokasjon ikke er registrert',
    sceneOptionalLabel: 'Scene (valgfri)',
    noSceneLabel: 'Ingen scene',
    notesLabel: 'Notater',
    notesPlaceholder: 'Skriv notater her...',
    scheduleStatusScheduled: 'Planlagt',
    scheduleStatusCompleted: 'Fullført',
    scheduleStatusCancelled: 'Avlyst',
    allProjectsLabel: 'Alle prosjekter ({count})',
    lastUpdatedLabel: 'Sist endret:',
    unknownLabel: 'Ukjent',
    candidatesCountLabel: '{count} kandidater',
    confirmDeleteProjectShort: 'Er du sikker på at du vil slette "{project}"?',
    confirmDeleteProjectDialogBody: 'Er du sikker på at du vil slette prosjektet "{project}"?',
    deleteProjectWarning: 'Denne handlingen kan ikke angres. All data knyttet til prosjektet vil bli permanent slettet.',
    projectDeleteErrorShort: 'Kunne ikke slette prosjektet.',
    closeLabel: 'Lukk',
    projectIdLabel: 'Prosjekt-ID',
    editProjectTitle: 'Rediger Prosjekt',
    newCastingProjectTitle: 'Nytt Casting Prosjekt',
    newProjectPrefix: 'Nytt',
    sceneFallbackPrefix: 'Scene',
    professionPhotographerName: 'Fotograf',
    termPhotoProject: 'Fotoprosjekt',
    termPhotoShot: 'Bilde',
    termPhotoShoot: 'Fotoshooting',
    termPhotoShootDay: 'Fotodag',
    termPhotoShotList: 'Bildeliste',
    termPhotoPortfolio: 'Portefølje',
    termPhotoSingle: 'Foto',
    termPhotoPlural: 'Bilder',
    professionVideographerName: 'Videograf',
    termVideoProject: 'Videoprosjekt',
    termVideoShot: 'Scene',
    termVideoShoot: 'Filming',
    termVideoShootDay: 'Filmdag',
    termVideoShotList: 'Sceneliste',
    termVideoPortfolio: 'Showreel',
    termVideoSingle: 'Video',
    termVideoPlural: 'Videoer',
    propsHeaderLabel: 'Rekvisitter',
    storyArcBackLabel: 'Tilbake',
    fabLabel: 'Hurtignavigasjon',
    fabIcon: 'speedDial',
    importDialogTitle: 'Importer Manuskript fra JSON',
    importDialogInfo: 'Last opp en JSON-fil eksportert fra Manuskript-systemet.',
    importSelectFile: 'Klikk for å velge fil eller dra fil hit',
    importFileFormat: '.json format (JSON)',
    importValidationErrorTitle: 'Feil ved validering:',
    importValidatedSuccess: 'JSON-fil validert og klar for import',
    importMetadataTitle: 'Metadata',
    importContentTitle: 'Innhold',
    importFieldTitle: 'Tittel:',
    importFieldAuthor: 'Forfatter:',
    importFieldFormat: 'Format:',
    importFieldExported: 'Eksportert:',
    importStatsScenes: 'Scener',
    importStatsActs: 'Akter',
    importStatsCharacters: 'Karakterer',
    importStatsDialogue: 'Dialogue linjer',
    importStatsRevisions: 'Revisions',
    importStatsRuntime: 'Estimert runtime',
    importIdWarning: 'Nye ID-er vil genereres for alle elementer for å unngå konflikter. De originale ID-ene bevares i historikken.',
    importImporting: 'Importerer manuskript...',
    importCompleteTitle: 'Importering fullført!',
    importCompleteBody: 'Manuskriptet er klar for bruk. Lukk dialogen for å fortsette.',
    importCancel: 'Avbryt',
    importChooseAnother: 'Velg annen fil',
    importAction: 'Importer',
    importClose: 'Lukk',
    importToastFileLoaded: 'Fil lastet inn - kontroller data før import',
    importToastUnknownError: 'Ukjent feil',
    importToastReadError: 'Kunne ikke lese JSON-fil',
    importToastImported: 'Manuskript importert med nye ID-er',
    importToastImportFailed: 'Import feilet',
    manuscriptHeader: 'Manuskript & Script',
    manuscriptHeaderMobile: 'Manuskript',
    manuscriptAutoBreakdown: 'Auto Breakdown',
    manuscriptAutoShort: 'Auto',
    manuscriptExport: 'Eksporter',
    manuscriptSave: 'Lagre',
    manuscriptImport: 'Importer',
    manuscriptTemplates: 'Maler',
    manuscriptNew: 'Nytt Manuskript',
    manuscriptNewShort: 'Nytt',
    manuscriptListTitle: 'Dine Manuskripter',
    manuscriptOpenHint: 'Klikk for å åpne',
    manuscriptNoProjectMessage: 'Velg eller opprett et prosjekt fra oversikten for å begynne å skrive manus.',
    manuscriptNoProjectTitle: 'Velg et prosjekt',
    manuscriptOpenButton: 'Åpne',
    manuscriptUnknownAuthor: 'Ukjent forfatter',
    manuscriptDeleteConfirm: 'Er du sikker på at du vil slette',
    manuscriptEmptyTitle: 'Ingen manuskripter ennå',
    manuscriptEmptyBody: 'Opprett ditt første manuskript eller importer et eksisterende',
    manuscriptEmptyCta: 'Opprett nytt manuskript',
    manuscriptBackShort: '← Tilbake',
    manuscriptBackLong: '← Tilbake til kortvisning',
    exportTooltip: 'Eksporter hele manuskriptet med produksjondata som JSON',
    importTooltip: 'Importer manuskript fra tidligere eksport',
    manuscriptUploadCoverTooltip: 'Last opp omslagsbilde',
    manuscriptEditTooltip: 'Rediger manuskript',
    manuscriptDeleteTooltip: 'Slett manuskript',
    manuscriptCoverLabel: 'Cover-bilde',
    manuscriptUploadCoverButton: 'Last opp cover',
    manuscriptRemoveCoverButton: 'Fjern cover',
    manuscriptCoverHint: 'Anbefalt storrelse: 600x900px',
    manuscriptDialogNewTitle: 'Nytt manuskript',
    manuscriptDialogEditTitle: 'Rediger manuskript',
    manuscriptFieldTitleLabel: 'Tittel',
    manuscriptFieldSubtitleLabel: 'Undertittel',
    manuscriptFieldAuthorLabel: 'Forfatter',
    manuscriptFieldFormatLabel: 'Format',
    manuscriptFormatFountain: 'Fountain (anbefalt)',
    manuscriptFormatMarkdown: 'Markdown',
    manuscriptFormatFinalDraft: 'Final Draft',
    manuscriptDialogCancel: 'Avbryt',
    manuscriptDialogCreate: 'Opprett',
    manuscriptDialogStatusLabel: 'Status',
    manuscriptStatusDraft: 'Utkast',
    manuscriptStatusReview: 'Gjennomgang',
    manuscriptStatusApproved: 'Godkjent',
    manuscriptStatusProduction: 'Produksjon',
    manuscriptStatusCompleted: 'Fullfort',
    manuscriptDialogSaveChanges: 'Lagre endringer',
    manuscriptUpdatedSuccess: 'Manuskript oppdatert',
    manuscriptToastLoaded: 'Manuskripter lastet',
    manuscriptToastLoadError: 'Feil ved lasting av manuskripter',
    manuscriptToastLoadScenesError: 'Feil ved lasting av scener',
    manuscriptToastLoadActsError: 'Feil ved lasting av akter',
    manuscriptToastLoadDialogueError: 'Feil ved lasting av dialog',
    manuscriptToastLoadRevisionsError: 'Feil ved lasting av revisjoner',
    manuscriptToastOnline: 'Tilkoblet nettverk',
    manuscriptToastOffline: 'Frakoblet - arbeider i offline-modus',
    manuscriptToastMissingTitle: 'Vennligst fyll inn tittel',
    manuscriptToastCreated: 'Manuskript opprettet',
    manuscriptToastCreateError: 'Feil ved opprettelse av manuskript',
    manuscriptToastSaved: 'Manuskript lagret',
    manuscriptToastSaveError: 'Feil ved lagring av manuskript',
    manuscriptToastAutoBreakdownPrefix: 'Automatisk breakdown fullført: ',
    manuscriptToastAutoBreakdownScenesLabel: ' scener, ',
    manuscriptToastAutoBreakdownCharactersLabel: ' karakterer funnet',
    manuscriptToastAutoBreakdownError: 'Feil ved automatisk breakdown',
    manuscriptToastExported: 'Manuskript eksportert som JSON',
    manuscriptToastExportError: 'Feil ved eksport',
    manuscriptToastImported: 'Manuskript importert og klar for bruk',
    manuscriptToastImportError: 'Feil ved import',
    manuscriptToastTemplateAppliedPrefix: 'Mal "',
    manuscriptToastTemplateAppliedSuffix: '" brukt',
    manuscriptToastTemplateApplyError: 'Feil ved bruk av mal',
    manuscriptToastTemplateInsertedPrefix: 'Mal "',
    manuscriptToastTemplateInsertedSuffix: '" satt inn',
    manuscriptToastParsedScenesPrefix: 'Parsed ',
    manuscriptToastParsedScenesSuffix: ' scenes from screenplay',
    manuscriptToastDeleted: 'Manuskript slettet',
    manuscriptToastDeleteError: 'Feil ved sletting av manuskript',
    manuscriptToastCoverUpdated: 'Cover oppdatert',
    manuscriptToastSceneSaved: 'Scene lagret',
    manuscriptToastSceneSaveError: 'Kunne ikke lagre scene-endringer',
    manuscriptToastSceneDeleted: 'Scene slettet',
    manuscriptToastSceneDeleteError: 'Kunne ikke slette scene',
    manuscriptToastSceneCreated: 'Ny scene opprettet',
    manuscriptToastSceneCreateError: 'Kunne ikke opprette scene',
    manuscriptToastSceneOrderUpdated: 'Scene-rekkefølge oppdatert',
    manuscriptToastSceneOrderError: 'Kunne ikke oppdatere scene-rekkefølge',
    manuscriptToastUpdateError: 'Kunne ikke lagre manuskript-endringer',
    manuscriptToastParsedHeadingsPrefix: 'Parsert ',
    manuscriptToastParsedHeadingsSuffix: ' scener fra manuskriptet',
    manuscriptPagesSuffix: 'sider',
    manuscriptMinutesSuffix: 'min',
    manuscriptScenesSuffix: 'scener',
    manuscriptCharactersSuffix: 'karakterer',
    manuscriptWordsSuffix: 'ord',
    manuscriptStatusDraftBadge: 'UTKAST',
    manuscriptStatusReviewBadge: 'GJENNOMGANG',
    manuscriptStatusApprovedBadge: 'GODKJENT',
    manuscriptStatusProductionBadge: 'PRODUKSJON',
    manuscriptStatusCompletedBadge: 'FULLFORT',
    manuscriptSavedLabelShort: 'Lagret',
    manuscriptSavedLabel: 'Lagret',
    manuscriptSavingLabel: 'Lagrer...',
    manuscriptUnsavedShort: '● Ulagret',
    manuscriptUnsavedLong: '● Ulagret endringer',
    manuscriptSaveErrorTooltip: 'Feil ved automatisk lagring - prov manuell lagring',
    manuscriptSaveErrorLabel: 'Lagringsfeil',
    manuscriptOnlineTooltip: 'Tilkoblet nettverk',
    manuscriptOfflineTooltip: 'Arbeider offline - endringer lagres lokalt',
    manuscriptTabEditor: 'Editor',
    manuscriptTabActs: 'Akter',
    manuscriptTabScenes: 'Scener',
    manuscriptTabCharacters: 'Karakterer',
    manuscriptTabDialogue: 'Dialog',
    manuscriptTabBreakdown: 'Breakdown',
    manuscriptTabRevisions: 'Revisjoner',
    manuscriptTabTimeline: 'Timeline',
    manuscriptTabProduction: 'Produksjon',
    manuscriptTabProductionView: 'Production View',
    manuscriptTooltipPages: 'Omtrent antall sider basert pa manus',
    manuscriptTooltipRuntime: 'Estimert spilletid basert pa industristandard (1 side ~ 1 min)',
    manuscriptTooltipWords: 'Totalt antall ord i manuset',
    manuscriptTooltipHeadings: 'Antall sceneoverskrifter i manuset',
    manuscriptTooltipCharacters: 'Antall unike karakterer i manuset',
    manuscriptEmptyIcon: 'description',
    manuscriptActsTitle: 'Akter / Kapitler',
    manuscriptActsAddShort: 'Ny Akt',
    manuscriptActsAddLong: 'Legg til Akt',
    manuscriptActsEmptyTitle: 'Ingen akter enna',
    manuscriptActsEmptyBody: 'Opprett akter for a strukturere manuskriptet i kapitler eller akter.',
    manuscriptActsEmptyIcon: 'menuBook',
    manuscriptActsCardTitlePrefix: 'Akt',
    manuscriptActsNoDescription: 'Ingen beskrivelse',
    manuscriptActsNoPages: 'Ingen sider',
    manuscriptActsPageLabel: 's.',
    manuscriptActsTableNumber: 'Akt #',
    manuscriptActsTableTitle: 'Tittel',
    manuscriptActsTableDescription: 'Beskrivelse',
    manuscriptActsTablePages: 'Sider',
    manuscriptActsTableDuration: 'Varighet',
    manuscriptActsTableActions: 'Handlinger',
    manuscriptActsDialogNewTitle: 'Ny Akt',
    manuscriptActsDialogEditTitle: 'Rediger Akt',
    manuscriptActsFieldNumber: 'Akt Nummer',
    manuscriptActsFieldTitle: 'Tittel',
    manuscriptActsFieldDescription: 'Beskrivelse',
    manuscriptActsFieldPageStart: 'Start Side',
    manuscriptActsFieldPageEnd: 'Slutt Side',
    manuscriptActsFieldRuntime: 'Estimert Varighet (minutter)',
    manuscriptActsFieldColor: 'Fargekode (hex)',
    manuscriptActsFieldColorPlaceholder: '#FF5733',
    manuscriptActsDialogCancel: 'Avbryt',
    manuscriptActsDialogCreate: 'Opprett',
    manuscriptActsDialogUpdate: 'Oppdater',
    manuscriptActsSuccessUpdated: 'Akt oppdatert',
    manuscriptActsSuccessCreated: 'Akt opprettet',
    manuscriptActsSuccessDeleted: 'Akt slettet',
    manuscriptActsErrorSave: 'Feil ved lagring av akt',
    manuscriptActsErrorDelete: 'Feil ved sletting av akt',
    manuscriptActsDeleteConfirm: 'Er du sikker pa at du vil slette denne akten?',
    manuscriptScenesTitle: 'Scene Breakdown',
    manuscriptScenesAddShort: 'Ny Scene',
    manuscriptScenesAddLong: 'Legg til Scene',
    manuscriptScenesEmptyTitle: 'Ingen scener enna',
    manuscriptScenesEmptyBody: 'Bruk "Auto Breakdown" for a generere scener fra manuskriptet.',
    manuscriptScenesEmptyIcon: 'scene',
    manuscriptScenesTableSceneNumber: 'Scene #',
    manuscriptScenesTableHeading: 'Heading',
    manuscriptScenesTableIntExt: 'INT/EXT',
    manuscriptScenesTableTime: 'Time',
    manuscriptScenesTablePages: 'Pages',
    manuscriptScenesTableCharacters: 'Characters',
    manuscriptScenesTableStatus: 'Status',
    manuscriptScenesTableActions: 'Actions',
    manuscriptScenesSceneLabel: 'Scene',
    manuscriptScenesPageSuffix: 'sider',
    manuscriptScenesCharactersSuffix: 'karakterer',
    manuscriptCharactersTitle: 'Karakterer',
    manuscriptCharactersSearchPlaceholder: 'Sok karakterer...',
    manuscriptCharactersLeadCount: 'hovedroller',
    manuscriptCharactersSupportingCount: 'biroller',
    manuscriptCharactersMinorCount: 'mindre roller',
    manuscriptCharactersEmptyTitle: 'Ingen karakterer funnet',
    manuscriptCharactersEmptyBody: 'Karakterer hentes fra dialog og scenedata.',
    manuscriptCharactersEmptyIcon: 'person',
    manuscriptCharactersAliasPrefix: 'aka',
    manuscriptCharactersAgeLabel: 'Alder',
    manuscriptCharactersDialogueLabel: 'replikker',
    manuscriptCharactersSceneLabel: 'scener',
    manuscriptCharactersScenesLabel: 'Scener',
    manuscriptCharactersScenesMoreSuffix: 'til',
    manuscriptCharactersDialogTitle: 'Rediger Karakter',
    manuscriptCharactersFieldAlias: 'Kallenavn / Alias',
    manuscriptCharactersFieldAliasPlaceholder: "F.eks. 'Dr. N' eller 'Paleontologen'",
    manuscriptCharactersFieldAge: 'Alder',
    manuscriptCharactersFieldAgePlaceholder: "F.eks. '30s' eller '45'",
    manuscriptCharactersFieldRole: 'Rolletype',
    manuscriptCharactersRoleLead: 'Hovedrolle',
    manuscriptCharactersRoleSupporting: 'Birolle',
    manuscriptCharactersRoleMinor: 'Liten rolle',
    manuscriptCharactersRoleExtra: 'Statist',
    manuscriptCharactersFieldDescription: 'Beskrivelse',
    manuscriptCharactersFieldDescriptionPlaceholder: 'Karakterbeskrivelse, bakgrunn, motivasjon...',
    manuscriptCharactersDialogCancel: 'Avbryt',
    manuscriptCharactersDialogSave: 'Lagre',
    manuscriptCharactersUpdatedSuccess: 'Karakterprofil oppdatert',
    manuscriptDialogueTitle: 'All Dialog',
    manuscriptDialogueAddButton: 'Legg til Replikk',
    manuscriptDialogueFilterCharacter: 'Filtrer karakter',
    manuscriptDialogueFilterScene: 'Filtrer scene',
    manuscriptDialogueFilterAll: 'Alle',
    manuscriptDialogueEmptyTitle: 'Ingen dialog funnet enna',
    manuscriptDialogueEmptyBody: 'Klikk "Legg til Replikk" for a starte.',
    manuscriptDialogueEmptyIcon: 'chat',
    manuscriptDialogueDialogEditTitle: 'Rediger Replikk',
    manuscriptDialogueDialogNewTitle: 'Ny Replikk',
    manuscriptDialogueFieldCharacter: 'Karakter',
    manuscriptDialogueFieldCharacterPlaceholder: 'F.eks. NORA TIDEMANN',
    manuscriptDialogueFieldCharacterHelper: 'Skriv karakternavnet i store bokstaver',
    manuscriptDialogueFieldScene: 'Scene',
    manuscriptDialogueFieldDialogue: 'Dialog',
    manuscriptDialogueFieldDialoguePlaceholder: 'Hva sier karakteren?',
    manuscriptDialogueFieldParenthetical: 'Parentetisk (valgfritt)',
    manuscriptDialogueFieldParentheticalPlaceholder: 'F.eks. smilende, bekymret, til Anna',
    manuscriptDialogueFieldParentheticalHelper: 'Regiinstruksjoner for skuespilleren',
    manuscriptDialogueFieldEmotion: 'Emosjon (valgfritt)',
    manuscriptDialogueEmotionNone: 'Ingen',
    manuscriptDialogueEmotionNeutral: 'Noytral',
    manuscriptDialogueEmotionHappy: 'Glad',
    manuscriptDialogueEmotionSad: 'Trist',
    manuscriptDialogueEmotionAngry: 'Sint',
    manuscriptDialogueEmotionFrightened: 'Redd',
    manuscriptDialogueEmotionSurprised: 'Overrasket',
    manuscriptDialogueEmotionConfused: 'Forvirret',
    manuscriptDialogueEmotionDetermined: 'Bestemt',
    manuscriptDialogueEmotionHopeful: 'Hapefull',
    manuscriptDialogueEmotionDesperate: 'Desperat',
    manuscriptDialogueEmotionWistful: 'Vemodig',
    manuscriptDialogueEmotionMysterious: 'Mystisk',
    manuscriptDialogueDialogCancel: 'Avbryt',
    manuscriptDialogueDialogCreate: 'Opprett',
    manuscriptDialogueDialogUpdate: 'Oppdater',
    manuscriptDialogueDeleteConfirm: 'Er du sikker pa at du vil slette denne replikken?',
    manuscriptDialogueSuccessCreated: 'Dialog opprettet og synkronisert',
    manuscriptDialogueSuccessUpdated: 'Dialog oppdatert og synkronisert',
    manuscriptDialogueSuccessDeleted: 'Dialog slettet og synkronisert',
    manuscriptDialogueErrorSave: 'Feil ved lagring av dialog',
    manuscriptDialogueErrorDelete: 'Feil ved sletting av dialog',
    manuscriptBreakdownTitle: 'Production Breakdown',
    manuscriptBreakdownTotalScenes: 'Total Scenes',
    manuscriptBreakdownIntScenes: 'INT Scenes',
    manuscriptBreakdownExtScenes: 'EXT Scenes',
    manuscriptBreakdownDayNight: 'Day/Night',
    manuscriptBreakdownSceneHeader: 'Scene',
    manuscriptBreakdownLocationHeader: 'Location',
    manuscriptBreakdownCharactersHeader: 'Characters',
    manuscriptBreakdownPropsHeader: 'Props',
    manuscriptBreakdownSpecialNotesHeader: 'Special Notes',
    manuscriptBreakdownVfx: 'VFX',
    manuscriptBreakdownStunts: 'Stunts',
    manuscriptBreakdownVehicles: 'Vehicles',
    manuscriptBreakdownCharsSuffix: 'chars',
    manuscriptBreakdownPropsSuffix: 'props',
    manuscriptRevisionsTitleShort: 'Revisjoner',
    manuscriptRevisionsTitleLong: 'Script Revisjoner & Diff Viewer',
    manuscriptRevisionsNewShort: 'Ny',
    manuscriptRevisionsNewLong: 'Ny Revisjon',
    manuscriptRevisionsEmptyTitle: 'Ingen revisjoner enna',
    manuscriptRevisionsEmptyBodyShort: 'Opprett en for a lagre snapshots.',
    manuscriptRevisionsEmptyBodyLong: 'Opprett en revisjon for a lagre et snapshot av manuskriptet og kunne sammenligne endringer over tid.',
    manuscriptRevisionsEmptyIcon: 'history',
    manuscriptRevisionsHistoryTitle: 'Revisjonshistorikk',
    manuscriptRevisionsNoDescription: 'Ingen beskrivelse',
    manuscriptRevisionsRestoreTooltip: 'Gjenopprett',
    manuscriptRevisionsDeleteTooltip: 'Slett',
    manuscriptRevisionsDeleteConfirm: 'Er du sikker pa at du vil slette denne revisjonen?',
    manuscriptRevisionsDeleteError: 'Feil ved sletting av revisjon',
    manuscriptRevisionsRestoreConfirm: 'Vil du gjenopprette denne versjonen? Gjeldende endringer vil bli overskrevet.',
    manuscriptRevisionsRestoredSuccess: 'Revisjon gjenopprettet',
    manuscriptRevisionsDeletedSuccess: 'Revisjon slettet',
    manuscriptRevisionsCreateDialogTitle: 'Opprett Ny Revisjon',
    manuscriptRevisionsCreateInfoShort: 'En revisjon lagrer et snapshot av manuskriptet.',
    manuscriptRevisionsCreateInfoLong: 'En revisjon lagrer et snapshot av gjeldende manuskript. Du kan senere sammenligne revisjoner og se endringer over tid.',
    manuscriptRevisionsNameLabel: 'Revisjonsnavn',
    manuscriptRevisionsNamePlaceholder: "F.eks. 'Draft 2' eller 'Etter regimote'",
    manuscriptRevisionsNotesLabel: 'Notater / Endringsbeskrivelse',
    manuscriptRevisionsNotesPlaceholder: 'Beskriv hva som er endret i denne revisjonen...',
    manuscriptRevisionsCurrentVersionLabel: 'Gjeldende',
    manuscriptRevisionsNewVersionLabel: 'Ny',
    manuscriptRevisionsSaveShort: 'Lagre',
    manuscriptRevisionsSaveLong: 'Lagre Revisjon',
    manuscriptRevisionsNameRequiredError: 'Revisjonsnavn er pakrevd',
    manuscriptRevisionsCreateError: 'Feil ved opprettelse av revisjon',
    manuscriptRevisionsCreatedSuccess: 'Revisjon opprettet',
    storyLogicSystemTitle: 'Story Logic System',
    storyLogicSystemSubtitle: 'Validate your story foundation before writing',
    storyLogicUnlock: 'Unlock to edit',
    storyLogicLock: 'Lock to prevent changes',
    storyLogicReset: 'Reset all',
    storyLogicSave: 'Save',
    storyLogicOverall: 'Overall Story Foundation',
    storyLogicLastSaved: 'Last saved:',
    storyLogicConceptLabel: 'Concept',
    storyLogicLoglineLabel: 'Logline',
    storyLogicThemeLabel: 'Theme',
    storyLogicPhaseConcept: 'Concept',
    storyLogicPhaseConceptPurpose: 'Validate the idea before any writing. Is this worth months of work?',
    storyLogicResetConfirm: 'Are you sure you want to reset all Story Logic data?',
    storyLogicCorePremiseLabel: 'Core Premise',
    storyLogicCorePremisePlaceholder: 'What is your story about in 2-3 sentences? The fundamental idea.',
    storyLogicPrimaryGenreLabel: 'Primary Genre',
    storyLogicSubGenreLabel: 'Sub-Genre',
    storyLogicToneLabel: 'Tone (select 1-3)',
    storyLogicTargetAudienceLabel: 'Target Audience',
    storyLogicTargetAudiencePlaceholder: 'Who is this story for? Be specific.',
    storyLogicAudienceAgeLabel: 'Audience Age Range',
    storyLogicWhyNowLabel: 'Why This Story Now?',
    storyLogicWhyNowPlaceholder: 'What makes this story relevant today? Why should audiences care RIGHT NOW?',
    storyLogicUniqueAngleLabel: 'Unique Angle',
    storyLogicUniqueAnglePlaceholder: 'What makes YOUR take on this concept different from everything else?',
    storyLogicMarketComparablesLabel: 'Market Comparables',
    storyLogicMarketComparablesPlaceholder: "e.g., 'Inception meets The Matrix' or 'Breaking Bad in the fashion industry'",
    storyLogicValidationConceptTitle: 'Concept',
    storyLogicPhaseLoglineTitle: 'Logline',
    storyLogicPhaseLoglinePurpose: "Define story DNA in one sentence. If it's weak, do not proceed.",
    storyLogicLoglineFormulaTitle: 'Logline Formula:',
    storyLogicLoglineFormulaBody: 'When [PROTAGONIST] must [GOAL], they face [ANTAGONISTIC FORCE]—or else [STAKES].',
    storyLogicProtagonistLabel: 'Protagonist',
    storyLogicProtagonistPlaceholder: 'Who is your main character? (role/occupation)',
    storyLogicProtagonistTraitLabel: 'Defining Trait',
    storyLogicProtagonistTraitPlaceholder: "e.g., 'burnt-out', 'naive', 'ruthless'",
    storyLogicGoalLabel: 'Goal',
    storyLogicGoalPlaceholder: 'What must the protagonist achieve? (action verb + objective)',
    storyLogicAntagonistLabel: 'Antagonistic Force',
    storyLogicAntagonistPlaceholder: 'Person, system, internal struggle, or force of nature',
    storyLogicStakesLabel: 'Stakes',
    storyLogicStakesPlaceholder: 'What happens if the protagonist fails? (consequences)',
    storyLogicGenerateLogline: 'Generate Logline from Components',
    storyLogicCompleteLoglineLabel: 'Complete Logline',
    storyLogicCompleteLoglinePlaceholder: 'Write your complete logline here (25-50 words ideal)',
    storyLogicWordCountLabel: 'words',
    storyLogicStrengthLabel: 'Logline Strength:',
    storyLogicValidationLoglineTitle: 'Logline',
    storyLogicPhaseThemeTitle: 'Theme & Character Intent',
    storyLogicPhaseThemePurpose: 'Give the story meaning. This prevents hollow or episodic scripts.',
    storyLogicCentralThemeLabel: 'Central Theme',
    storyLogicCentralThemePlaceholder: 'e.g., redemption, identity, power, love, sacrifice',
    storyLogicMoralArgumentLabel: 'Moral Argument',
    storyLogicMoralArgumentPlaceholder: "What is the story's stance on the theme?",
    storyLogicThemeStatementLabel: 'Theme Statement',
    storyLogicThemeStatementPlaceholder: 'This story argues that... (complete the sentence)',
    storyLogicCharacterTransformationTitle: 'Character Transformation',
    storyLogicProtagonistFlawLabel: "Protagonist's Core Flaw",
    storyLogicProtagonistFlawPlaceholder: 'What internal weakness holds them back?',
    storyLogicFlawOriginLabel: 'Flaw Origin',
    storyLogicFlawOriginPlaceholder: 'Where did this flaw come from? (backstory)',
    storyLogicWhatMustChangeLabel: 'What Must Change by the End',
    storyLogicWhatMustChangePlaceholder: 'What belief, behavior, or worldview must the protagonist abandon or embrace?',
    storyLogicTransformationArcLabel: 'Transformation Arc',
    storyLogicTransformationArcPlaceholder: 'Describe the journey from flawed beginning to transformed end. How do they change?',
    storyLogicEmotionalJourneyLabel: 'Emotional Journey Beats (select 3-5 key emotions)',
    storyLogicEmotionalArcLabel: 'Emotional Arc:',
    storyLogicValidationThemeTitle: 'Theme',
    storyLogicSummaryReadyTitle: 'Story Foundation Ready!',
    storyLogicSummaryReadyBody: 'Your story logic is validated. You can proceed to outlining and writing with confidence.',
    storyLogicSummaryTitle: 'Summary',
    storyLogicSummaryGenreLabel: 'Genre:',
    storyLogicSummaryToneLabel: 'Tone:',
    storyLogicSummaryThemeLabel: 'Theme:',
    storyLogicPhaseLabel: 'Phase',
    storyLogicStatusIncomplete: 'Incomplete',
    storyLogicStatusWeak: 'Weak',
    storyLogicStatusReady: 'Ready',
    storyLogicValidationSuffix: 'Validation',
    storyLogicLoglineWhen: 'When',
    storyLogicLoglineArticle: 'a',
    storyLogicLoglineMust: 'must',
    storyLogicLoglineFaces: 'they face',
    storyLogicLoglineOrElse: 'or else',
    storyLogicConceptSuggestionCorePremiseExpand: 'Expand your core premise to capture the full scope of your story.',
    storyLogicConceptWarningCorePremiseShort: 'Core premise is too short or missing.',
    storyLogicConceptWarningPrimaryGenre: 'Select a primary genre.',
    storyLogicConceptSuggestionToneNarrow: 'Consider narrowing your tones to 2-3 for a more focused story.',
    storyLogicConceptWarningToneMissing: 'Select at least one tone for your story.',
    storyLogicConceptWarningTargetAudience: 'Define your target audience more specifically.',
    storyLogicConceptSuggestionWhyNowExpand: 'The "Why Now" section is crucial. Expand on current relevance.',
    storyLogicConceptWarningWhyNowMissing: '"Why this story now?" needs more thought.',
    storyLogicConceptWarningUniqueAngle: 'What makes YOUR take unique? This is essential.',
    storyLogicConceptSuggestionComparables: 'Good! Comparables help position your story in the market.',
    storyLogicLoglineWarningProtagonist: 'Define your protagonist.',
    storyLogicLoglineWarningGoal: 'What does your protagonist want?',
    storyLogicLoglineWarningAntagonist: 'Define the antagonistic force (person, system, or internal).',
    storyLogicLoglineWarningStakes: 'What happens if the protagonist fails?',
    storyLogicLoglineSuggestionWhenStart: 'Consider starting with "When..." to set up the inciting incident.',
    storyLogicLoglineSuggestionMustInclude: 'Include what the protagonist "must" do.',
    storyLogicLoglineSuggestionAddStakes: 'Add stakes: "or else..." / "before..." to raise tension.',
    storyLogicLoglineWarningComplete: 'Write your complete logline (aim for 25-50 words).',
    storyLogicThemeWarningCentralTheme: 'Define your central theme (e.g., redemption, identity, love).',
    storyLogicThemeSuggestionThemeStatementFormat: 'A theme statement often follows: "This story argues that..."',
    storyLogicThemeWarningThemeStatement: 'Write a theme statement: what is your story arguing?',
    storyLogicThemeWarningProtagonistFlaw: "Define your protagonist's central flaw.",
    storyLogicThemeWarningMustChange: 'What belief or behavior must the protagonist change?',
    storyLogicThemeWarningTransformationArc: 'Describe the transformation arc from flaw to growth.',
    storyLogicThemeSuggestionEmotionalBeats: 'Map at least 3-5 key emotional beats in your story.',
    storyLogicGenreDrama: 'Drama',
    storyLogicGenreComedy: 'Comedy',
    storyLogicGenreAction: 'Action',
    storyLogicGenreThriller: 'Thriller',
    storyLogicGenreHorror: 'Horror',
    storyLogicGenreSciFi: 'Sci-Fi',
    storyLogicGenreFantasy: 'Fantasy',
    storyLogicGenreRomance: 'Romance',
    storyLogicGenreMystery: 'Mystery',
    storyLogicGenreCrime: 'Crime',
    storyLogicGenreDocumentary: 'Documentary',
    storyLogicGenreAnimation: 'Animation',
    storyLogicGenreMusical: 'Musical',
    storyLogicGenreWestern: 'Western',
    storyLogicGenreWar: 'War',
    storyLogicGenreBiography: 'Biography',
    storyLogicSubGenreDramaFamily: 'Family Drama',
    storyLogicSubGenreDramaLegal: 'Legal Drama',
    storyLogicSubGenreDramaMedical: 'Medical Drama',
    storyLogicSubGenreDramaPolitical: 'Political Drama',
    storyLogicSubGenreDramaSports: 'Sports Drama',
    storyLogicSubGenreComedyRomantic: 'Romantic Comedy',
    storyLogicSubGenreComedyDark: 'Dark Comedy',
    storyLogicSubGenreComedySatire: 'Satire',
    storyLogicSubGenreComedySlapstick: 'Slapstick',
    storyLogicSubGenreComedyParody: 'Parody',
    storyLogicSubGenreActionMartialArts: 'Martial Arts',
    storyLogicSubGenreActionSpy: 'Spy Action',
    storyLogicSubGenreActionHeist: 'Heist',
    storyLogicSubGenreActionDisaster: 'Disaster',
    storyLogicSubGenreActionSuperhero: 'Superhero',
    storyLogicSubGenreThrillerPsychological: 'Psychological',
    storyLogicSubGenreThrillerPolitical: 'Political',
    storyLogicSubGenreThrillerLegal: 'Legal',
    storyLogicSubGenreThrillerTechno: 'Techno',
    storyLogicSubGenreThrillerConspiracy: 'Conspiracy',
    storyLogicSubGenreHorrorSupernatural: 'Supernatural',
    storyLogicSubGenreHorrorSlasher: 'Slasher',
    storyLogicSubGenreHorrorPsychological: 'Psychological',
    storyLogicSubGenreHorrorBody: 'Body Horror',
    storyLogicSubGenreHorrorFoundFootage: 'Found Footage',
    storyLogicSubGenreSciFiSpaceOpera: 'Space Opera',
    storyLogicSubGenreSciFiCyberpunk: 'Cyberpunk',
    storyLogicSubGenreSciFiPostApocalyptic: 'Post-Apocalyptic',
    storyLogicSubGenreSciFiTimeTravel: 'Time Travel',
    storyLogicSubGenreSciFiAlienInvasion: 'Alien Invasion',
    storyLogicSubGenreFantasyEpic: 'Epic Fantasy',
    storyLogicSubGenreFantasyUrban: 'Urban Fantasy',
    storyLogicSubGenreFantasyDark: 'Dark Fantasy',
    storyLogicSubGenreFantasyFairyTale: 'Fairy Tale',
    storyLogicSubGenreFantasyMythological: 'Mythological',
    storyLogicSubGenreRomancePeriod: 'Period Romance',
    storyLogicSubGenreRomanceContemporary: 'Contemporary',
    storyLogicSubGenreRomanceParanormal: 'Paranormal Romance',
    storyLogicSubGenreRomanceTragic: 'Tragic Romance',
    storyLogicSubGenreMysteryWhodunit: 'Whodunit',
    storyLogicSubGenreMysteryNoir: 'Noir',
    storyLogicSubGenreMysteryCozy: 'Cozy Mystery',
    storyLogicSubGenreMysteryProcedural: 'Procedural',
    storyLogicSubGenreCrimeGangster: 'Gangster',
    storyLogicSubGenreCrimeHeist: 'Heist',
    storyLogicSubGenreCrimeTrueCrime: 'True Crime',
    storyLogicSubGenreCrimeNeoNoir: 'Neo-Noir',
    storyLogicToneDark: 'Dark',
    storyLogicToneLight: 'Light',
    storyLogicToneSerious: 'Serious',
    storyLogicToneComedic: 'Comedic',
    storyLogicToneSuspenseful: 'Suspenseful',
    storyLogicToneHopeful: 'Hopeful',
    storyLogicToneMelancholic: 'Melancholic',
    storyLogicToneSatirical: 'Satirical',
    storyLogicToneGritty: 'Gritty',
    storyLogicToneWhimsical: 'Whimsical',
    storyLogicToneIntense: 'Intense',
    storyLogicToneRomantic: 'Romantic',
    storyLogicToneCynical: 'Cynical',
    storyLogicToneInspirational: 'Inspirational',
    storyLogicToneSurreal: 'Surreal',
    storyLogicToneNostalgic: 'Nostalgic',
    storyLogicAudienceChildrenUnder12: 'Children (Under 12)',
    storyLogicAudienceTeen13To17: 'Teen (13-17)',
    storyLogicAudienceYoungAdult18To25: 'Young Adult (18-25)',
    storyLogicAudienceAdult26To45: 'Adult (26-45)',
    storyLogicAudienceMatureAdult46To65: 'Mature Adult (46-65)',
    storyLogicAudienceSenior65Plus: 'Senior (65+)',
    storyLogicAudienceAllAges: 'All Ages',
    storyLogicEmotionHope: 'Hope',
    storyLogicEmotionFear: 'Fear',
    storyLogicEmotionJoy: 'Joy',
    storyLogicEmotionSadness: 'Sadness',
    storyLogicEmotionAnger: 'Anger',
    storyLogicEmotionSurprise: 'Surprise',
    storyLogicEmotionDisgust: 'Disgust',
    storyLogicEmotionTrust: 'Trust',
    storyLogicEmotionAnticipation: 'Anticipation',
    storyLogicEmotionLove: 'Love',
    storyLogicEmotionShame: 'Shame',
    storyLogicEmotionPride: 'Pride',
    storyLogicEmotionGuilt: 'Guilt',
    storyLogicEmotionRelief: 'Relief',
    storyLogicEmotionDespair: 'Despair',
    storyLogicEmotionTriumph: 'Triumph',
    templatePanelTitle: 'Manuskriptmaler',
    templateSearchPlaceholder: 'Sok etter maler...',
    templateTabAll: 'Alle',
    templateTabMine: 'Mine maler',
    templateTabRecent: 'Nylig brukt',
    templateTabStructures: 'Strukturer',
    templateEmpty: 'Ingen maler funnet',
    templateStoryBeatsLabel: 'story beats',
    templatePagesLabel: 'sider',
    templateBeatPagePrefix: 's.',
    templateDeleteConfirm: 'Er du sikker pa at du vil slette denne malen?',
    templatePreviewTooltip: 'Forhandsvis',
    templateApplyTooltip: 'Bruk mal',
    templatePreviewClose: 'Lukk',
    templatePreviewApply: 'Bruk mal',
    productionReadLabel: 'READ THROUGH',
    productionReadShort: 'READ',
    productionReadThrough: 'READ THROUGH',
    productionReadThroughShort: 'READ',
    productionManuscriptLabel: 'MANUSKRIPT',
    productionManuscriptShort: 'MANUS',
    productionSceneLabel: 'Scene',
    productionLineLabel: 'Linje',
    productionOfLabel: 'av',
    productionZoomIn: 'Zoom inn',
    productionZoomOut: 'Zoom ut',
    productionHeaderShort: 'PRODUCTION',
    productionHeaderLong: 'PRODUCTION MANUSCRIPT',
    productionShortcutsTitle: 'Keyboard Shortcuts',
    productionShortcutsLabel: 'SHORTCUTS',
    productionShortcutPlayPause: 'Space: Play/Pause timeline',
    productionShortcutNavigate: '↑/↓: Navigate scenes',
    productionShortcutUndo: 'Ctrl+Z: Undo',
    productionShortcutRedo: 'Ctrl+Shift+Z: Redo',
    productionShortcutSelectAll: 'Ctrl+A: Select all',
    productionShortcutDelete: 'Delete: Delete scene(s)',
    productionShortcutClear: 'Esc: Clear selection',
    productionReadThroughStart: 'Start Read Through',
    productionReadThroughStop: 'Avslutt Read Through',
    productionTalentShow: 'Vis Cast',
    productionTalentHide: 'Skjul Cast',
    productionQuickNotesTooltip: 'Quick Notes (Ctrl+T)',
    productionDuplicateSceneTooltip: 'Duplicate Scene (Ctrl+D)',
    productionSaveTemplateTooltip: 'Save Template (Ctrl+S)',
    productionExportPdfTooltip: 'Export as PDF (Ctrl+E)',
    productionCallSheetTooltip: 'Call Sheet (Ctrl+Shift+E)',
    productionStripboardTooltip: 'Stripboard - Shooting Schedule',
    productionShootingDayPlannerTooltip: 'Opptaksplan - Day Planner',
    productionLiveSetTooltip: 'Live Set Mode - On-Set Tracking',
    productionLiveSetConnectTooltip: 'Koble til Live Set (synkroniser timeline)',
    productionLiveSetDisconnectTooltip: 'Koble fra Live Set',
    productionSearchPlaceholder: 'Søk i scener...',
    productionFiltersLabel: 'SMART FILTRE',
    productionScenesLabel: 'Scener',
    productionScenesLabelLower: 'scener',
    productionScenesShortLabel: 'SCENER',
    productionShotsLabel: 'Shots',
    productionShotsLabelLower: 'shots',
    productionShotsLabelUpper: 'SHOTS',
    productionCameraLabel: 'Kamera',
    productionCameraLabelUpper: 'KAMERA',
    productionLightLabelUpper: 'LYS',
    productionSoundLabelUpper: 'LYD',
    productionLightLabel: 'Lys',
    productionSoundLabel: 'Lyd',
    productionTagsLabel: 'Tags',
    productionProgressLabel: 'PRODUKSJONSFREMDRIFT',
    productionCompleteLabel: 'ferdig',
    productionTotalLabel: 'totalt',
    productionSortNumber: 'Sort: Number',
    productionSortDuration: 'Sort: Duration',
    productionSortDate: 'Sort: Date',
    productionSortName: 'Sort: Name',
    productionSortAscending: 'Ascending',
    productionSortDescending: 'Descending',
    productionSortByLabel: 'SORT BY',
    productionSortOptionNumber: 'Number',
    productionSortOptionDuration: 'Duration',
    productionSortOptionDate: 'Date',
    productionSortOptionName: 'Name',
    productionActLabel: 'Akt',
    productionVisibleLabel: 'synlig',
    productionBatchScenesSelected: 'scenes selected',
    productionBatchSceneSelected: 'scene selected',
    productionBatchExportTooltip: 'Export selected',
    productionBatchDeleteTooltip: 'Delete selected',
    productionBatchClearTooltip: 'Clear selection',
    productionBatchDeleteConfirmPrefix: 'Delete',
    productionBatchDeleteConfirmSuffix: 'selected scenes?',
    productionAddSceneTooltip: 'Legg til scene',
    productionNewSceneLabel: 'Ny scene',
    productionNewSceneDialogTitle: 'Opprett ny scene',
    productionNewSceneDialogBody: 'En ny scene vil bli opprettet med standardverdier. Du kan redigere scenen etterpå.',
    productionNewSceneDialogAction: 'Opprett scene',
    productionNewSceneHeadingDefault: 'NY SCENE',
    productionNewSceneLocationDefault: 'Lokasjon',
    productionNewSceneIntDefault: 'INT',
    productionNewSceneTimeDefault: 'DAY',
    productionDeleteSceneTitle: 'Slett scene?',
    productionDeleteSceneBody: 'Er du sikker på at du vil slette denne scenen? Denne handlingen kan ikke angres.',
    productionDeleteSceneAction: 'Slett scene',
    productionExportProductionTooltip: 'Eksporter produksjonsdata',
    productionSceneBadgeLabel: 'SCENE',
    productionInteriorLabel: 'Interior',
    productionExteriorLabel: 'Exterior',
    productionQuickActionsLabel: 'PRODUKSJON:',
    productionNeedsTooltip: 'Sett scene behov (kamera/lys/lyd)',
    productionNeedsButton: 'Behov',
    productionScheduleTooltip: 'Planlegg scene på opptaksdag',
    productionScheduleButton: 'Planlegg',
    productionChecklistTooltip: 'Pre-produksjon sjekkliste',
    productionChecklistButton: 'Sjekkliste',
    productionBulkShotsTooltip: 'Generer flere shots fra mal',
    productionBulkShotsButton: '+ Shots',
    productionLineCoverageTooltip: 'Shot-til-dialog dekning',
    productionLineCoverageButton: 'Linjedekning',
    productionSyncStatusTooltip: 'Synk status med Stripboard',
    productionSyncStatusButton: 'Synk',
    productionReferenceImageLabel: 'REFERANSEBILDE',
    productionReferenceFromCasting: 'FRA CASTING',
    productionDialogueLabel: 'DIALOG',
    productionDialogueLinesLabel: 'replikker',
    productionDialogueLinesTitle: 'DIALOGLINJER',
    productionNoDialogueLabel: 'Ingen dialog i denne scenen',
    productionReadThroughNotesLabel: 'READ THROUGH NOTES',
    productionProductionNotesLabel: 'PRODUCTION NOTES',
    productionAddNoteTooltip: 'Legg til note',
    productionReadThroughPlaceholder: 'Skriv noter fra read-through...',
    productionCameraNoteLabel: 'KAMERA NOTE',
    productionCameraNoteEditPlaceholder: 'Skriv kamera note...',
    productionCameraNotePlaceholder: 'Klikk for å legge til kamera note...',
    productionDirectorNoteLabel: 'REGISSØR',
    productionDirectorNoteEditPlaceholder: 'Skriv regissør note...',
    productionDirectorNotePlaceholder: 'Klikk for å legge til regissør note...',
    productionStatusLabel: 'STATUS:',
    productionStatusNotStarted: 'Ikke startet',
    productionStatusInProgress: 'Pågår',
    productionStatusComplete: 'Ferdig',
    productionStoryboardShotsLabel: 'STORYBOARD SHOTS',
    productionAddShotTooltip: 'Legg til shot',
    productionNoShotsLabel: 'Ingen shots i denne scenen',
    productionAddFirstShotLabel: 'Legg til første shot',
    productionSelectSceneTitle: 'Velg en scene fra listen',
    productionSelectSceneBody: 'Klikk på en scene i venstre panel for å se manuskriptet',
    productionTimelineLabel: 'TIMELINE',
    productionTimelinePause: 'Pause',
    productionTimelinePlay: 'Play',
    productionTimelineZoomIn: 'Zoom inn',
    productionTimelineZoomOut: 'Zoom ut',
    productionOvertimeLabel: 'Overtid',
    productionGridView: 'Grid view',
    productionGridViewActive: 'Grid view aktiv',
    productionListView: 'List view',
    productionListViewActive: 'List view aktiv',
    productionAudioLabel: 'AUDIO',
    productionVideoLabel: 'VIDEO',
    productionActiveSceneLabel: 'AKTIV SCENE',
    productionSceneFallback: 'SCENE 1',
    productionIntFallback: 'INT',
    productionLocationFallback: 'LOCATION',
    productionTimeFallback: 'DAY',
    productionShotLabel: 'SHOT',
    productionShotFallbackType: 'CLOSE-UP',
    productionShotTypeWide: 'WIDE',
    productionShotTypeCloseUp: 'CLOSE-UP',
    productionShotTypeMedium: 'MEDIUM',
    productionShotTypeExtremeCloseUp: 'EXTREME CLOSE-UP',
    productionShotTypeEstablishing: 'ESTABLISHING',
    productionShotTypeDetail: 'DETAIL',
    productionShotTypeTwoShot: 'TWO SHOT',
    productionShotTypeOverShoulder: 'OVER SHOULDER',
    productionShotTypePOV: 'POV',
    productionShotTypeInsert: 'INSERT',
    productionNewShotDescriptionDefault: 'Ny shot',
    productionShotInspectorLabel: 'SHOT INSPECTOR',
    productionShotDetailsFallback: 'Shot Details',
    productionCameraSectionLabel: 'KAMERA',
    productionLensLabel: 'Linse',
    productionMovementLabel: 'Bevegelse',
    productionFramingLabel: 'Framing',
    productionNotSetLabel: 'Not set',
    productionLightingSectionLabel: 'LYS',
    productionKeyLightLabel: 'Key Light',
    productionTemperatureLabel: 'Temp',
    productionRatioLabel: 'Ratio',
    productionSoundSectionLabel: 'LYD',
    productionMicLabel: 'Mic',
    productionAmbienceLabel: 'Ambience',
    productionNotesLabel: 'Notes',
    productionCameraEquipmentLabel: 'KAMERAUTSTYR',
    productionSyncedTooltip: 'Koblet til utstyrsinventar',
    productionSyncedLabel: 'SYNKRONISERT',
    productionInventoryLabel: 'FRA INVENTAR',
    productionStandardLabel: 'STANDARD',
    productionLensLabelUpper: 'LINSE',
    productionRigLabel: 'RIG',
    productionShotTypeLabel: 'SHOT-TYPE',
    productionShotListLabel: 'FRA SHOT LISTER',
    productionCopySettingsTooltip: 'Kopier innstillinger til neste shot',
    productionSavePresetTooltip: 'Lagre som preset',
    productionReferencesLabel: 'REFERANSER',
    productionReferencesUploadedSuffix: 'opplastet',
    productionReferencesSources: 'shot.cafe & Unsplash',
    productionReferencesUploadedLabel: 'OPPLASTEDE',
    productionReferenceUploadedSource: 'Opplastet',
    productionReferenceTitlePrefix: 'Referanse',
    productionCenterPanelLabel: 'Sentrum',
    productionUploadLabel: 'Last opp',
    productionSearchReferencesLabel: 'Søk referanser',
    productionReferenceSearchTitle: 'Søk Filmreferanser',
    productionReferenceSearchBack: '← Tilbake til søk',
    productionReferenceSearchPlaceholder: 'Søk film: Blade Runner, Inception, cinematographer: Roger Deakins...',
    productionSearchLabel: 'Søk',
    productionSourceAllLabel: 'Alle kilder',
    productionSourceShotCafeLabel: 'shot.cafe',
    productionSourceUnsplashLabel: 'Unsplash',
    productionReferenceSearchLoading: 'Søker i filmdatabasen...',
    productionReferenceQuerySceneFallback: 'scene',
    productionReferenceQueryDayFallback: 'day',
    productionReferenceQuerySuffix: 'cinematic',
    productionReferenceAttributionDemoImage: 'Demo Image',
    productionReferenceAttributionReferenceImage: 'Reference Image',
    productionDefaultCamera: 'ARRI Alexa Mini LF',
    productionDefaultLens: '50mm Prime',
    productionDefaultRig: 'Stativ',
    productionDefaultShotType: 'Close-up',
    productionDefaultKeyLight: 'Mykt sidelys',
    productionDefaultSideLight: 'Varm tone',
    productionDefaultGel: 'Gel: Warm 1/4 CTO',
    productionDefaultMic: 'Boom Mic',
    productionDefaultAtmos: 'Dempet romlyd',
    productionCameraAngleEyeLevel: 'Eye Level',
    productionLensOption50mmPrime: '50mm Prime',
    productionLensOption35mmPrime: '35mm Prime',
    productionLensOption85mmPrime: '85mm Prime',
    productionLensOption24_70Zoom: '24-70mm Zoom',
    productionLensOption70_200Zoom: '70-200mm Zoom',
    productionLensOption16mmWide: '16mm Wide',
    productionLensOption100mmMacro: '100mm Macro',
    productionRigOptionTripod: 'Stativ',
    productionRigOptionSteadicam: 'Steadicam',
    productionRigOptionGimbal: 'Gimbal',
    productionRigOptionHandheld: 'Handheld',
    productionRigOptionDolly: 'Dolly',
    productionRigOptionCrane: 'Crane',
    productionRigOptionDrone: 'Drone',
    productionRigOptionShoulderRig: 'Shoulder Rig',
    productionRigOptionSlider: 'Slider',
    productionKeyLightOptionSoftSide: 'Mykt sidelys',
    productionKeyLightOptionKeyLight1200: 'Key Light – 1200W',
    productionKeyLightOptionKeyLight600: 'Key Light – 600W',
    productionKeyLightOptionSoftbox: 'Softbox',
    productionKeyLightOptionLedPanel: 'LED Panel',
    productionKeyLightOptionHmi: 'HMI',
    productionKeyLightOptionNatural: 'Natural Light',
    productionSideLightOptionWarmTone: 'Varm tone',
    productionSideLightOptionSideLighting: 'Side Lighting',
    productionSideLightOptionFillLight: 'Fill Light',
    productionSideLightOptionRimLight: 'Rim Light',
    productionSideLightOptionBackLight: 'Back Light',
    productionSideLightOptionPractical: 'Practical',
    productionSideLightOptionNatural: 'Natural',
    productionGelOptionWarmQuarterCto: 'Gel: Warm 1/4 CTO',
    productionGelOptionWarmHalfCto: 'Gel: Warm 1/2 CTO',
    productionGelOptionFullCto: 'Gel: Full CTO',
    productionGelOptionQuarterCtb: 'Gel: 1/4 CTB',
    productionGelOptionHalfCtb: 'Gel: 1/2 CTB',
    productionGelOptionNone: 'No Gel',
    productionMicOptionBoom: 'Boom Mic',
    productionMicOptionLav: 'Lav Mic',
    productionMicOptionShotgun: 'Shotgun Mic',
    productionMicOptionWirelessLav: 'Wireless Lav',
    productionMicOptionPlant: 'Plant Mic',
    productionAtmosOptionRoomTone: 'Dempet romlyd',
    productionAtmosOptionQuiet: 'Atmos: Stille',
    productionAtmosOptionNatural: 'Atmos: Naturlig',
    productionAtmosOptionCityTraffic: 'Atmos: Bytrafikk',
    productionAtmosOptionNature: 'Atmos: Natur',
    productionAtmosOptionInterior: 'Atmos: Interiør',
    productionCameraSonyFx6: 'Sony FX6',
    productionCameraSonyFx3: 'Sony FX3',
    productionCameraSonyA7s3: 'Sony A7S III',
    productionCameraSonyVenice2: 'Sony Venice 2',
    productionCameraRedKomodo: 'RED Komodo',
    productionCameraRedVRaptor: 'RED V-Raptor',
    productionCameraArriAlexaMiniLf: 'ARRI Alexa Mini LF',
    productionCameraArriAlexa35: 'ARRI Alexa 35',
    productionCameraBlackmagicUrsaMiniPro: 'Blackmagic URSA Mini Pro',
    productionCameraCanonC70: 'Canon C70',
    productionCameraCanonR5c: 'Canon R5 C',
    productionCameraPanasonicS1h: 'Panasonic S1H',
    productionLensDefault50mmPrime: '50mm Prime',
    productionLensDefault35mmPrime: '35mm Prime',
    productionLensDefault85mmPrime: '85mm Prime',
    productionLensDefault2470mm: '24-70mm',
    productionMovementStatic: 'Static',
    productionMovementSlowPushIn: 'Rolig push-in',
    productionMovementDolly: 'Dolly',
    productionMovementPan: 'Pan',
    productionFramingWide: 'Wide',
    productionFramingMedium: 'Medium',
    productionFramingCloseUp: 'Close-up',
    productionFramingExtremeCloseUp: 'Extreme Close-up',
    productionLightingKeySoftSide: 'Mykt sidelys',
    productionLightingKey4ft: 'Key light 4ft',
    productionLightingKeyBacklightOnly: 'Backlight only',
    productionLightingKeyRingLight: 'Ring light',
    productionLightingTemp3200k: '3200K',
    productionLightingTemp5600k: '5600K',
    productionLightingTemp4300k: '4300K',
    productionLightingRatio3to1: '3:1',
    productionLightingRatio2to1: '2:1',
    productionLightingRatio4to1: '4:1',
    productionLightingRatio1_5to1: '1.5:1',
    productionSoundMicBoom: 'Boom Mic',
    productionSoundMicLav: 'Lav Mic',
    productionSoundMicWireless: 'Wireless',
    productionSoundMicStudio: 'Studio',
    productionSoundAmbienceQuietInterior: 'Quiet interior',
    productionSoundAmbienceStreetTraffic: 'Street traffic',
    productionSoundAmbienceForest: 'Forest',
    productionSoundAmbienceEmptyRoom: 'Empty room',
    productionSoundNotesMonitorLevels: 'Monitor levels closely',
    productionSoundNotesWatchWind: 'Watch for wind',
    productionSoundNotesAcHum: 'AC hum present',
    productionSoundNotesCleanTake: 'Clean take',
    productionTimelineMarker0000: '00:00',
    productionTimelineMarker0030: '00:30',
    productionTimelineMarker0100: '01:00',
    productionTimelineMarker0130: '01:30',
    productionTimelineMarker0200: '02:00',
    productionTimelineMarker0230: '02:30',
    productionTimelineMarker0300: '03:00',
    productionSortAscendingSymbol: '↑',
    productionSortDescendingSymbol: '↓',
    productionDirectorNoteBadge: 'R',
    productionBatchExportFilenamePrefix: 'selected_scenes_',
    productionBatchExportFilenameSuffix: '.json',
    productionReferenceSelectFramePrefix: 'Velg en frame fra',
    productionReferenceSelectFrameSuffix: 'for å legge til som referanse',
    productionReferenceChooseAction: 'Velg handling',
    productionAddToCenterPanelLabel: '+ Senterpanel',
    productionOpenShotCafeLabel: 'Se alle frames på shot.cafe',
    productionShotCafeFilmsLabel: 'Filmer fra shot.cafe',
    productionResultsLabel: 'resultater',
    productionFramesLabel: 'frames',
    productionCinematographerLabel: 'DP:',
    productionMoodImagesLabel: 'Stemningsbilder',
    productionReferenceEmptyTitle: 'Søk etter filmreferanser',
    productionReferenceEmptyBody: 'Søk etter filmer som "Blade Runner", "Sicario" eller cinematografer som "Roger Deakins"',
    productionReferenceAttribution: 'Filmreferanser fra shot.cafe • Stemningsbilder fra Unsplash • Kun for referanse og utdanning',
    productionReferenceTagBladeRunner: 'Blade Runner',
    productionReferenceTagNoir: 'Noir',
    productionReferenceTagGoldenHour: 'Golden Hour',
    productionReferenceTagSilhouette: 'Silhouette',
    productionReferenceTagCloseUp: 'Close-up',
    productionReferenceTagWideShot: 'Wide Shot',
    productionReferenceTagSicario: 'Sicario',
    productionReferenceTagJoker: 'Joker',
    productionReferenceTagDune: 'Dune',
    productionReferenceTagTheBatman: 'The Batman',
    productionReferenceTagInterstellar: 'Interstellar',
    productionReferenceTagRogerDeakins: 'Roger Deakins',
    productionReferenceTagChivo: 'Chivo',
    productionStripboardTitlePrefix: 'Stripboard -',
    productionShootingDayPlannerTitlePrefix: 'Opptaksplan -',
    productionLiveSetDayTitle: 'Velg Opptaksdag for Live Set',
    productionLiveSetDayBody: 'Velg hvilken opptaksdag du vil følge i Live Set Mode:',
    productionDayLabel: 'Dag',
    productionDayStatusWrapped: 'Ferdig',
    productionDayStatusInProgress: 'Pågår',
    productionDayStatusPlanned: 'Planlagt',
    productionCallSheetPreviewTitlePrefix: 'Call Sheet Preview -',
    productionCallSheetFilenamePrefix: 'call_sheet_',
    productionExportDialogTitle: 'Eksporter produksjonsdata',
    productionExportDialogBody: 'Eksporter alle scener, utstyr, shot lists og metadata som JSON-fil.',
    productionExportDialogContentsLabel: 'Innhold:',
    productionExportDialogEquipmentLabel: 'Utstyr og metadata',
    productionExportDialogAction: 'Eksporter JSON',
    productionPdfSceneLabel: 'SCENE',
    productionPdfCharactersLabel: 'CHARACTERS',
    productionPdfShotsLabel: 'SHOTS',
    productionPdfNotesLabel: 'NOTES',
    productionPdfNoDescription: 'No description',
    productionPdfNoCharacters: 'None',
    productionPdfNoNotes: 'No notes',
    productionTalentPanelTitle: 'Cast & Talent',
    productionSceneLabelUpper: 'SCENE',
    productionCharactersLabel: 'karakterer',
    productionConfirmedCastLabel: 'CONFIRMED CAST',
    productionInSceneLabel: 'I SCENE',
    productionNoConfirmedCastTitle: 'Ingen bekreftet cast ennå',
    productionNoConfirmedCastBodyPrefix: 'Gå til Auditions i',
    productionNoConfirmedCastBodySuffix: 'for å bekrefte kandidater',
    productionQuickNotesTitle: 'Quick Notes - Scene',
    productionQuickNotesPlaceholder: 'Add production notes, warnings, special instructions...',
    productionDoneLabel: 'Done',
    productionSaveTemplateTitle: 'Save Scene as Template',
    productionTemplateNameLabel: 'Template Name',
    productionTemplateNamePlaceholder: "e.g., 'Indoor Dialogue', 'Action Sequence'",
    productionAvailableTemplatesLabel: 'Available Templates:',
    productionNoTemplatesLabel: 'No templates saved yet',
    productionSaveTemplateAction: 'Save Template',
    productionTagsFiltersTitle: 'Scene Tags & Filters',
    productionSelectedLabel: 'selected',
    productionSceneTagsLabel: 'SCENE TAGS',
    productionEquipmentNeedsLabel: 'EQUIPMENT NEEDS',
    productionMissingCameraEquipmentLabel: 'Missing Camera Equipment',
    productionMissingLightingLabel: 'Missing Lighting',
    productionMissingAudioLabel: 'Missing Audio Equipment',
    productionCloseLabel: 'Close',
    productionSavePresetDialogTitle: 'Lagre som preset',
    productionSavePresetDialogBody: 'Gi presetet et navn for å lagre gjeldende kamera- og lysinnstillinger.',
    productionSavePresetNamePlaceholder: "F.eks. 'Intim dialog', 'Action scene'",
    productionSavePresetSettingsLabel: 'Innstillinger som lagres:',
    productionShotTypeValueLabel: 'Shot type',
    productionSavePresetAction: 'Lagre preset',
    productionAddNoteTitle: 'Legg til produksjonsnotis',
    productionAddNoteBodyPrefix: 'Velg type notis for scene',
    productionAddNoteTypeLabel: 'Type',
    productionDirectorLabel: 'Regissør',
    productionVfxLabel: 'VFX',
    productionAddNotePlaceholder: 'Skriv notis...',
    productionAddLabel: 'Legg til',
    productionAddShotDialogTitle: 'Legg til storyboard shot',
    productionBackLabel: '← Tilbake',
    productionAddShotModeLabel: 'Velg hvordan du vil legge til et shot til scene',
    productionAddShotUploadTitle: 'Last opp eget bilde',
    productionAddShotUploadBody: 'Last opp storyboard eller referansebilde fra din maskin',
    productionAddShotReferenceTitle: 'Søk referanseshots',
    productionAddShotReferenceBody: 'Finn inspirasjon fra Shot.cafe, filmer og bildedatabaser',
    productionAddShotUploadPrompt: 'Last opp et bilde for ditt storyboard shot',
    productionAddShotChooseAnother: 'Velg annet bilde',
    productionAddShotPickImage: 'Klikk for å velge bilde',
    productionAddShotFormats: 'Støtter JPG, PNG, WebP',
    productionAddShotReferencePrompt: 'Søk etter referansebilder fra Shot.cafe og andre kilder',
    productionAddShotSearchPlaceholder: 'Søk: Blade Runner, cinematographer: Roger Deakins, noir lighting...',
    productionAddShotWithImage: 'Legg til med bilde',
    productionAddShotWithoutImage: 'Legg til uten bilde',
    productionSceneNeedsTitle: 'Scene Behov - Scene',
    productionSceneNeedsBody: 'Marker hvilke avdelinger som mangler planlegging for denne scenen:',
    productionSceneNeedsCameraDetail: 'Linse, bevegelse, rigg ikke planlagt',
    productionSceneNeedsLightDetail: 'Lysplan ikke ferdigstilt',
    productionSceneNeedsSoundDetail: 'Lydplan/mikrofon ikke satt',
    productionScheduleDialogTitle: 'Planlegg Scene til Stripboard',
    productionScheduleDialogBody: 'Velg opptaksdag for denne scenen:',
    productionScheduleRemoveLabel: 'Fjern fra plan (ikke planlagt)',
    productionChecklistDialogTitle: 'Pre-Production Checklist - Scene',
    productionChecklistReadyLabel: 'Ready for Production!',
    productionChecklistStatusLabel: 'Pre-Production Status',
    productionChecklistProgressLabel: 'av 6 oppgaver fullført',
    productionChecklistLocation: 'Lokasjon bekreftet',
    productionChecklistCast: 'Cast bekreftet tilgjengelig',
    productionChecklistProps: 'Rekvisitter klare',
    productionChecklistEquipment: 'Utstyr tildelt',
    productionChecklistPermits: 'Tillatelser innhentet',
    productionChecklistScript: 'Manus låst',
    productionBulkShotTitle: 'Generer Shot List - Scene',
    productionBulkShotBody: 'Velg en mal for å automatisk generere shots basert på scenetypen:',
    productionBulkTemplateStandardTitle: 'Standard Coverage',
    productionBulkTemplateStandardDescription: 'Wide, Medium, Close-up (3 shots)',
    productionShotTemplateStandard1: 'Establishing shot',
    productionShotTemplateStandard2: 'Two-shot or medium coverage',
    productionShotTemplateStandard3: 'Close-up reaction',
    productionBulkTemplateDialogueTitle: 'Dialogue Scene',
    productionBulkTemplateDialogueDescription: 'Master, OTS shots, Close-ups, Insert (6 shots)',
    productionShotTemplateDialogue1: 'Master shot - full scene coverage',
    productionShotTemplateDialogue2: 'Character A - OTS from B',
    productionShotTemplateDialogue3: 'Character B - OTS from A',
    productionShotTemplateDialogue4: 'Character A close-up',
    productionShotTemplateDialogue5: 'Character B close-up',
    productionShotTemplateDialogue6: 'Insert/cutaway',
    productionBulkTemplateActionTitle: 'Action Sequence',
    productionBulkTemplateActionDescription: 'Establishing, Action coverage, Reactions (6 shots)',
    productionShotTemplateAction1: 'Establishing action geography',
    productionShotTemplateAction2: 'Action coverage 1',
    productionShotTemplateAction3: 'Action coverage 2',
    productionShotTemplateAction4: 'Detail/impact shot',
    productionShotTemplateAction5: 'Reaction shot',
    productionShotTemplateAction6: 'Resolution/aftermath',
    productionBulkShotsCreatedLabel: 'SHOTS SOM VIL BLI OPPRETTET:',
    productionBulkShotsAction: 'Generer',
    productionLineCoverageTitle: 'Shot Line Coverage - Scene',
    productionLineCoverageBody: 'Marker hvilke dialoglinjer som dekkes av hver shot for continuity-tracking:',
    productionLinesCoveredLabel: 'linjer dekket',
    productionCoveredByLabel: 'Dekket av',
    productionUncoveredDialogueLabel: 'dialog linje(r) er ikke dekket av noen shots!',
    productionSceneExistsPrefix: 'Scene',
    productionSceneExistsSuffix: 'already exists',
    productionSceneNumberValidation: 'Scene number must be a number optionally followed by a letter (e.g., 5 or 5A)',
    productionSaveLabel: 'Lagre',
    productionExitFullscreen: 'Avslutt fullskjerm',
    productionEnterFullscreen: 'Fullskjerm',
    productionCancelLabel: 'Avbryt',
    storyArcStudio: 'Story Arc Studio',
    storyArcTagline: 'Planlegg og skriv din historie',
    storyArcLogicTitle: 'Story Logic',
    storyArcLogicSubtitle: 'Story Arc',
    storyLogicChip: 'Strukturer din historie',
    storyWriterTitle: 'Story Writer',
    storyWriterSubtitle: 'Story Planner',
    storyWriterChip: 'Skriv manuskript',
    storyLogicHeader: 'Story Logic - Story Arc',
    storyWriterHeader: 'Story Writer - Manuskript',
  },
};

export const DEFAULT_BRANDING_SETTINGS: BrandingSettings = {
  version: 1,
  identity: DEFAULT_IDENTITY,
  colors: DEFAULT_COLORS,
  typography: DEFAULT_TYPOGRAPHY,
  layout: DEFAULT_LAYOUT,
  tokens: DEFAULT_TOKENS,
  ...DEFAULT_IDENTITY,
};

const API_BASE = '/api/branding';

const normalizeSettings = (settings?: Partial<BrandingSettings>): BrandingSettings => {
  const legacyIdentityOverrides: Partial<BrandingIdentity> = {
    ...(settings?.appName ? { appName: settings.appName } : {}),
    ...(settings?.tagline ? { tagline: settings.tagline } : {}),
    ...(settings?.domain ? { domain: settings.domain } : {}),
    ...(settings?.supportEmail ? { supportEmail: settings.supportEmail } : {}),
    ...(settings?.docsUrl ? { docsUrl: settings.docsUrl } : {}),
    ...(settings?.logoUrl ? { logoUrl: settings.logoUrl } : {}),
    ...(settings?.iconUrl ? { iconUrl: settings.iconUrl } : {}),
    ...(settings?.faviconUrl ? { faviconUrl: settings.faviconUrl } : {}),
    ...(settings?.emailLogoUrl ? { emailLogoUrl: settings.emailLogoUrl } : {}),
    ...(settings?.landingHeroImageUrl ? { landingHeroImageUrl: settings.landingHeroImageUrl } : {}),
    ...(settings?.watermarkUrl ? { watermarkUrl: settings.watermarkUrl } : {}),
  };

  const identity: BrandingIdentity = {
    ...DEFAULT_IDENTITY,
    ...(settings?.identity ?? {}),
    ...legacyIdentityOverrides,
  };

  const merged: BrandingSettings = {
    ...DEFAULT_BRANDING_SETTINGS,
    ...(settings ?? {}),
    identity,
    colors: {
      ...DEFAULT_COLORS,
      ...(settings?.colors ?? {}),
    },
    typography: {
      ...DEFAULT_TYPOGRAPHY,
      ...(settings?.typography ?? {}),
    },
    layout: {
      ...DEFAULT_LAYOUT,
      ...(settings?.layout ?? {}),
    },
    tokens: {
      ...DEFAULT_TOKENS,
      ...(settings?.tokens ?? {}),
      labels: {
        ...DEFAULT_TOKENS.labels,
        ...(settings?.tokens?.labels ?? {}),
      },
    },
  };

  return {
    ...merged,
    ...identity,
  };
};

export const mergeBrandingSettings = (
  base: BrandingSettings,
  overrides?: Partial<BrandingSettings>
): BrandingSettings =>
  normalizeSettings({
    ...base,
    ...(overrides ?? {}),
    identity: {
      ...base.identity,
      ...(overrides?.identity ?? {}),
    },
    colors: {
      ...base.colors,
      ...(overrides?.colors ?? {}),
    },
    typography: {
      ...base.typography,
      ...(overrides?.typography ?? {}),
    },
    layout: {
      ...base.layout,
      ...(overrides?.layout ?? {}),
    },
    tokens: {
      ...base.tokens,
      ...(overrides?.tokens ?? {}),
      labels: {
        ...base.tokens.labels,
        ...(overrides?.tokens?.labels ?? {}),
      },
    },
  });

let cachedBrandingSettings: BrandingSettings = DEFAULT_BRANDING_SETTINGS;

const setCachedBrandingSettings = (settings: BrandingSettings): BrandingSettings => {
  const normalized = normalizeSettings(settings);
  cachedBrandingSettings = normalized;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('branding-updated', { detail: normalized }));
  }
  return normalized;
};

export const getBrandingSettings = (): BrandingSettings => cachedBrandingSettings;

export const saveBrandingSettings = (settings: BrandingSettings): BrandingSettings =>
  setCachedBrandingSettings(settings);

export const subscribeBrandingSettings = (
  listener: (settings: BrandingSettings) => void
): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<BrandingSettings>).detail;
    listener(detail ? normalizeSettings(detail) : getBrandingSettings());
  };

  window.addEventListener('branding-updated', handleCustomEvent);

  return () => {
    window.removeEventListener('branding-updated', handleCustomEvent);
  };
};

const getAdminRole = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const session = authSessionService.getSessionSync();
    const role = session.adminUser?.role;
    return role ? String(role).toLowerCase() : undefined;
  } catch (error) {
    console.warn('Failed to read admin role:', error);
    return undefined;
  }
};

export const fetchBrandingSettings = async (): Promise<BrandingSettings | null> => {
  const response = await fetch(`${API_BASE}/settings`);
  if (!response.ok) {
    throw new Error('Failed to fetch branding settings');
  }
  const data = (await response.json()) as { settings?: BrandingSettings | null };
  if (!data.settings) return null;
  return setCachedBrandingSettings(data.settings);
};

export const updateBrandingSettings = async (
  settings: BrandingSettings
): Promise<BrandingSettings> => {
  const normalized = normalizeSettings(settings);
  const role = getAdminRole();
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(role ? { 'X-Admin-Role': role } : {}),
    },
    body: JSON.stringify({ settings: normalized, role }),
  });
  if (!response.ok) {
    throw new Error('Failed to update branding settings');
  }
  const data = (await response.json()) as { settings?: BrandingSettings };
  return setCachedBrandingSettings(data.settings ?? normalized);
};
