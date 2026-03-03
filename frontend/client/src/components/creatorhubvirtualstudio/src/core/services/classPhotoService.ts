/**
 * Class Photo Service
 * 
 * Manages school/class photography sessions including:
 * - Student generation with height distribution
 * - Row arrangement and optimization
 * - Visibility checking
 * - Prop management for height adjustment
 */

import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export type AgeGroup = 'kindergarten' | 'elementary' | 'middle_school' | 'high_school';
export type HeightDistribution = 'random' | 'uniform' | 'bell_curve';
export type StudentPose = 'standing' | 'seated' | 'kneeling';
export type PropType = 'stool' | 'chair' | 'apple_box' | 'bench' | 'riser' | 'floor';
export type TeacherPosition = 'center_back' | 'left_end' | 'right_end' | 'both_ends' | 'center_front' | 'seated_center';
export type TeacherRole = 'head_teacher' | 'assistant' | 'aide' | 'principal';

export interface Teacher {
  id: string;
  name: string;
  role: TeacherRole;
  height: number;           // cm
  position: TeacherPosition;
  assignedRow: number;
  positionInRow: number;
  pose: StudentPose;
  position3D: THREE.Vector3;
  color: string;            // Distinct color for teacher
}

export interface Student {
  id: string;
  index: number;
  name: string;
  height: number;           // cm
  assignedRow: number;
  positionInRow: number;
  pose: StudentPose;
  standingOnProp?: string;  // Prop ID
  position3D: THREE.Vector3;
  visible: boolean;
  visibilityScore: number;  // 0-100
  isTeacher?: boolean;      // Flag for teacher
  teacherRole?: TeacherRole;
  teacherPosition?: TeacherPosition;
  color?: string;           // Custom color (for teachers)
}

export interface ClassPhotoRow {
  index: number;
  baseHeight: number;       // Floor/riser height in meters
  zPosition: number;        // Distance from camera
  studentIds: string[];
  propIds: string[];
  maxStudents: number;
}

export interface ClassPhotoProp {
  id: string;
  type: PropType;
  name: string;
  height: number;           // meters
  width: number;            // meters
  depth: number;            // meters
  seats: number;            // How many students can use it
  position: THREE.Vector3;
  rotation: number;         // Y rotation in radians
  assignedStudents: string[];
}

export interface TeacherConfig {
  role: TeacherRole;
  name: string;
  height: number;
  position: TeacherPosition;
}

export interface ClassPhotoSetup {
  studentCount: number;
  ageGroup: AgeGroup;
  heightDistribution: HeightDistribution;
  includeTeacher: boolean;
  teachers: TeacherConfig[];
  rowCount: number;
  arrangementStyle: 'tiered' | 'flat' | 'semi_circle';
  staggerPositions: boolean;
}

export interface ClassPhotoSession {
  id: string;
  name: string;
  setup: ClassPhotoSetup;
  students: Map<string, Student>;
  rows: ClassPhotoRow[];
  props: Map<string, ClassPhotoProp>;
  sceneWidth: number;       // meters
  sceneDepth: number;       // meters
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
}

export interface VisibilityIssue {
  studentId: string;
  blockedBy: string[];
  visibilityScore: number;
  suggestion: string;
}

export interface ArrangementResult {
  success: boolean;
  rows: ClassPhotoRow[];
  issues: VisibilityIssue[];
  suggestedProps: PropType[];
}

// =============================================================================
// Constants
// =============================================================================

// Height ranges by age group (in cm)
export const HEIGHT_RANGES: Record<AgeGroup, { min: number; max: number; avg: number }> = {
  kindergarten: { min: 95, max: 115, avg: 105 },
  elementary: { min: 110, max: 145, avg: 128 },
  middle_school: { min: 140, max: 175, avg: 155 },
  high_school: { min: 155, max: 190, avg: 170 },
};

// Teacher height range
export const TEACHER_HEIGHT = { min: 160, max: 185, avg: 172 };

// Teacher colors by role
export const TEACHER_COLORS: Record<TeacherRole, string> = {
  head_teacher: '#1565c0',    // Blue
  assistant: '#2e7d32',       // Green
  aide: '#7b1fa2',            // Purple
  principal: '#c62828',       // Red
};

// Teacher role labels
export const TEACHER_ROLE_LABELS: Record<TeacherRole, string> = {
  head_teacher: 'Head Teacher',
  assistant: 'Teaching Assistant',
  aide: 'Teacher Aide',
  principal: 'Principal',
};

// Default teacher configs
export const DEFAULT_TEACHER_CONFIGS: TeacherConfig[] = [
  { role: 'head_teacher', name: 'Teacher', height: 172, position: 'center_back' },
];

// Spacing constants (in meters)
export const SPACING = {
  betweenStudents: 0.45,      // Shoulder to shoulder
  betweenRows: 0.6,           // Front to back
  rowStagger: 0.22,           // Horizontal offset for visibility
  minHeadGap: 0.15,           // Minimum vertical gap between heads
  edgeMargin: 0.3,            // Space from edges
};

// Prop definitions
export const PROP_DEFINITIONS: Record<
  PropType,
  Omit<ClassPhotoProp, 'id' | 'position' | 'rotation' | 'assignedStudents'>
> = {
  floor: {
    type: 'floor',
    name: 'Floor',
    height: 0,
    width: 10,
    depth: 10,
    seats: 100,
  },
  stool: {
    type: 'stool',
    name: 'Stool',
    height: 0.35,
    width: 0.35,
    depth: 0.35,
    seats: 1,
  },
  chair: {
    type: 'chair',
    name: 'Folding Chair',
    height: 0.45,
    width: 0.45,
    depth: 0.45,
    seats: 1,
  },
  apple_box: {
    type: 'apple_box',
    name: 'Apple Box',
    height: 0.2,
    width: 0.5,
    depth: 0.3,
    seats: 1,
  },
  bench: {
    type: 'bench',
    name: 'Gym Bench',
    height: 0.4,
    width: 2.0,
    depth: 0.35,
    seats: 4,
  },
  riser: {
    type: 'riser',
    name: 'Photo Riser',
    height: 0.3,
    width: 3.0,
    depth: 0.6,
    seats: 8,
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a random height within the age group range
 */
function generateHeight(ageGroup: AgeGroup, distribution: HeightDistribution): number {
  const range = HEIGHT_RANGES[ageGroup];
  
  switch (distribution) {
    case 'uniform':
      return range.avg;
    
    case 'bell_curve': {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const stdDev = (range.max - range.min) / 6; // 99.7% within range
      const height = range.avg + z * stdDev;
      return Math.max(range.min, Math.min(range.max, height));
    }
    
    case 'random':
    default:
      return range.min + Math.random() * (range.max - range.min);
  }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate optimal row count based on student count
 */
function calculateOptimalRows(studentCount: number): number {
  if (studentCount <= 8) return 1;
  if (studentCount <= 15) return 2;
  if (studentCount <= 25) return 3;
  if (studentCount <= 40) return 4;
  return 5;
}

/**
 * Calculate row base heights for visibility
 */
function calculateRowHeights(rowCount: number, style: 'tiered' | 'flat' | 'semi_circle'): number[] {
  const heights: number[] = [];
  
  switch (style) {
    case 'flat':
      for (let i = 0; i < rowCount; i++) {
        heights.push(0);
      }
      break;
    
    case 'tiered':
      for (let i = 0; i < rowCount; i++) {
        // Each row is 20-30cm higher than previous
        heights.push(i * 0.25);
      }
      break;
    
    case 'semi_circle':
      for (let i = 0; i < rowCount; i++) {
        // Slight curve up at back
        heights.push(i * 0.15);
      }
      break;
  }
  
  return heights;
}

// =============================================================================
// Class Photo Service
// =============================================================================

export class ClassPhotoService {
  private session: ClassPhotoSession | null = null;

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  /**
   * Create a new class photo session
   */
  createSession(setup: ClassPhotoSetup): ClassPhotoSession {
    const id = generateId();
    
    // Generate students
    const students = new Map<string, Student>();
    for (let i = 0; i < setup.studentCount; i++) {
      const studentId = `student-${i + 1}`;
      students.set(studentId, {
        id: studentId,
        index: i,
        name: `Student ${i + 1}`,
        height: generateHeight(setup.ageGroup, setup.heightDistribution),
        assignedRow: -1,
        positionInRow: -1,
        pose: 'standing',
        position3D: new THREE.Vector3(),
        visible: true,
        visibilityScore: 100,
      });
    }
    
    // Add teachers if requested
    const teacherConfigs = setup.includeTeacher 
      ? (setup.teachers?.length > 0 ? setup.teachers : DEFAULT_TEACHER_CONFIGS)
      : [];
    
    teacherConfigs.forEach((teacherConfig, idx) => {
      const teacherId = `teacher-${idx + 1}`;
      students.set(teacherId, {
        id: teacherId,
        index: setup.studentCount + idx,
        name: teacherConfig.name || `Teacher ${idx + 1}`,
        height: teacherConfig.height || TEACHER_HEIGHT.avg,
        assignedRow: -1,
        positionInRow: -1,
        pose: teacherConfig.position === 'seated_center' ? 'seated' : 'standing',
        position3D: new THREE.Vector3(),
        visible: true,
        visibilityScore: 100,
        isTeacher: true,
        teacherRole: teacherConfig.role,
        teacherPosition: teacherConfig.position,
        color: TEACHER_COLORS[teacherConfig.role],
      });
    });
    
    // Calculate scene dimensions
    const totalStudents = setup.studentCount + teacherConfigs.length;
    const optimalRows = setup.rowCount || calculateOptimalRows(totalStudents);
    const studentsPerRow = Math.ceil(totalStudents / optimalRows);
    const sceneWidth = Math.max(3, studentsPerRow * SPACING.betweenStudents + SPACING.edgeMargin * 2);
    const sceneDepth = Math.max(2, optimalRows * SPACING.betweenRows + 1);
    
    // Create rows
    const rowHeights = calculateRowHeights(optimalRows, setup.arrangementStyle);
    const rows: ClassPhotoRow[] = [];
    for (let i = 0; i < optimalRows; i++) {
      rows.push({
        index: i,
        baseHeight: rowHeights[i],
        zPosition: -i * SPACING.betweenRows,
        studentIds: [],
        propIds: [],
        maxStudents: studentsPerRow + 2, // Allow some flexibility
      });
    }
    
    // Calculate camera position
    const cameraDistance = sceneWidth * 1.2 + sceneDepth;
    const cameraHeight = 1.5 + (optimalRows - 1) * 0.2;
    
    this.session = {
      id,
      name: 'Class Photo',
      setup: { ...setup, rowCount: optimalRows },
      students,
      rows,
      props: new Map(),
      sceneWidth,
      sceneDepth,
      cameraPosition: new THREE.Vector3(0, cameraHeight, cameraDistance),
      cameraTarget: new THREE.Vector3(0, 1.2, 0),
    };
    
    // Auto-arrange students
    this.autoArrangeStudents();
    
    return this.session;
  }

  /**
   * Get current session
   */
  getSession(): ClassPhotoSession | null {
    return this.session;
  }

  // ---------------------------------------------------------------------------
  // Student Management
  // ---------------------------------------------------------------------------

  /**
   * Update student height
   */
  updateStudentHeight(studentId: string, height: number): void {
    if (!this.session) return;
    
    const student = this.session.students.get(studentId);
    if (student) {
      student.height = Math.max(80, Math.min(200, height));
    }
  }

  /**
   * Randomize all student heights
   */
  randomizeHeights(): void {
    if (!this.session) return;
    
    for (const student of this.session.students.values()) {
      if (student.id !== 'teacher') {
        student.height = generateHeight(
          this.session.setup.ageGroup,
          this.session.setup.heightDistribution
        );
      }
    }
    
    this.autoArrangeStudents();
  }

  /**
   * Swap two students positions
   */
  swapStudents(studentId1: string, studentId2: string): void {
    if (!this.session) return;
    
    const s1 = this.session.students.get(studentId1);
    const s2 = this.session.students.get(studentId2);
    if (!s1 || !s2) return;
    
    // Swap row and position
    const tempRow = s1.assignedRow;
    const tempPos = s1.positionInRow;
    const tempPose = s1.pose;
    const tempProp = s1.standingOnProp;
    
    s1.assignedRow = s2.assignedRow;
    s1.positionInRow = s2.positionInRow;
    s1.pose = s2.pose;
    s1.standingOnProp = s2.standingOnProp;
    
    s2.assignedRow = tempRow;
    s2.positionInRow = tempPos;
    s2.pose = tempPose;
    s2.standingOnProp = tempProp;
    
    // Update row student lists
    this.rebuildRowStudentLists();
    this.calculateStudentPositions();
  }

  /**
   * Move student to a specific row
   */
  moveStudentToRow(studentId: string, targetRow: number): void {
    if (!this.session) return;
    
    const student = this.session.students.get(studentId);
    if (!student || targetRow < 0 || targetRow >= this.session.rows.length) return;
    
    // Remove from current row
    const currentRow = this.session.rows[student.assignedRow];
    if (currentRow) {
      currentRow.studentIds = currentRow.studentIds.filter(id => id !== studentId);
    }
    
    // Add to new row
    const newRow = this.session.rows[targetRow];
    student.assignedRow = targetRow;
    student.positionInRow = newRow.studentIds.length;
    newRow.studentIds.push(studentId);
    
    this.calculateStudentPositions();
  }

  // ---------------------------------------------------------------------------
  // Arrangement
  // ---------------------------------------------------------------------------

  /**
   * Auto-arrange students by height
   */
  autoArrangeStudents(): ArrangementResult {
    if (!this.session) {
      return { success: false, rows: [], issues: [], suggestedProps: [] };
    }
    
    // Separate teachers from students
    const allPeople = Array.from(this.session.students.values());
    const teachers = allPeople.filter(p => p.isTeacher);
    const students = allPeople.filter(p => !p.isTeacher);
    
    // Sort students by height
    const sortedStudents = students.sort((a, b) => a.height - b.height);
    
    const rowCount = this.session.rows.length;
    const totalStudents = sortedStudents.length;
    const basePerRow = Math.floor(totalStudents / rowCount);
    const extra = totalStudents % rowCount;
    
    // Clear existing assignments
    for (const row of this.session.rows) {
      row.studentIds = [];
    }
    
    // Distribute students: shortest in front, tallest in back
    let studentIndex = 0;
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      const studentsInThisRow = basePerRow + (rowIdx < extra ? 1 : 0);
      const row = this.session.rows[rowIdx];
      
      for (let posIdx = 0; posIdx < studentsInThisRow && studentIndex < totalStudents; posIdx++) {
        const student = sortedStudents[studentIndex];
        student.assignedRow = rowIdx;
        student.positionInRow = posIdx;
        student.pose = rowIdx === 0 ? 'seated' : 'standing';
        row.studentIds.push(student.id);
        studentIndex++;
      }
    }
    
    // Position teachers based on their specified position
    this.positionTeachers(teachers);
    
    // Stagger positions within rows for better visibility
    if (this.session.setup.staggerPositions) {
      this.staggerRowPositions();
    }
    
    // Calculate 3D positions
    this.calculateStudentPositions();
    
    // Check visibility
    const issues = this.checkVisibility();
    
    // Suggest props if needed
    const suggestedProps = this.suggestProps(issues);
    
    return {
      success: issues.length === 0,
      rows: this.session.rows,
      issues,
      suggestedProps,
    };
  }

  /**
   * Position teachers based on their specified positions
   */
  private positionTeachers(teachers: Student[]): void {
    if (!this.session || teachers.length === 0) return;
    
    const rowCount = this.session.rows.length;
    const backRowIdx = rowCount - 1;
    const frontRowIdx = 0;
    
    for (const teacher of teachers) {
      const position = teacher.teacherPosition || 'center_back';
      let targetRow: number;
      let insertPosition: 'start' | 'end' | 'center';
      
      switch (position) {
        case 'center_back':
          targetRow = backRowIdx;
          insertPosition = 'center';
          teacher.pose = 'standing';
          break;
        
        case 'left_end':
          targetRow = backRowIdx;
          insertPosition = 'start';
          teacher.pose = 'standing';
          break;
        
        case 'right_end':
          targetRow = backRowIdx;
          insertPosition = 'end';
          teacher.pose = 'standing';
          break;
        
        case 'both_ends':
          // For 'both_ends', we need to handle multiple teachers
          // First teacher goes left, second goes right
          const teacherIndex = teachers.indexOf(teacher);
          targetRow = backRowIdx;
          insertPosition = teacherIndex % 2 === 0 ? 'start' : 'end';
          teacher.pose = 'standing';
          break;
        
        case 'center_front':
          targetRow = frontRowIdx;
          insertPosition = 'center';
          teacher.pose = 'standing';
          break;
        
        case 'seated_center':
          targetRow = frontRowIdx;
          insertPosition = 'center';
          teacher.pose = 'seated';
          break;
        
        default:
          targetRow = backRowIdx;
          insertPosition = 'center';
          teacher.pose = 'standing';
      }
      
      const row = this.session.rows[targetRow];
      teacher.assignedRow = targetRow;
      
      // Insert teacher at the appropriate position
      switch (insertPosition) {
        case 'start':
          teacher.positionInRow = 0;
          row.studentIds.unshift(teacher.id);
          // Update positions for other students in this row
          row.studentIds.forEach((id, idx) => {
            const s = this.session!.students.get(id);
            if (s && s.id !== teacher.id) {
              s.positionInRow = idx;
            }
          });
          break;
        
        case 'end':
          teacher.positionInRow = row.studentIds.length;
          row.studentIds.push(teacher.id);
          break;
        
        case 'center':
        default:
          const centerIdx = Math.floor(row.studentIds.length / 2);
          teacher.positionInRow = centerIdx;
          row.studentIds.splice(centerIdx, 0, teacher.id);
          // Update positions for students after the teacher
          row.studentIds.forEach((id, idx) => {
            const s = this.session!.students.get(id);
            if (s) {
              s.positionInRow = idx;
            }
          });
          break;
      }
    }
  }

  /**
   * Stagger row positions so heads don't align
   */
  private staggerRowPositions(): void {
    if (!this.session) return;
    
    for (let rowIdx = 1; rowIdx < this.session.rows.length; rowIdx++) {
      const row = this.session.rows[rowIdx];
      const prevRow = this.session.rows[rowIdx - 1];
      
      // If this row has fewer or equal students, stagger
      if (row.studentIds.length <= prevRow.studentIds.length) {
        // Offset will be applied in calculateStudentPositions
      }
    }
  }

  /**
   * Calculate 3D positions for all students
   */
  private calculateStudentPositions(): void {
    if (!this.session) return;
    
    for (const row of this.session.rows) {
      const studentCount = row.studentIds.length;
      if (studentCount === 0) continue;
      
      const rowWidth = (studentCount - 1) * SPACING.betweenStudents;
      const startX = -rowWidth / 2;
      
      // Apply stagger for odd rows
      const staggerOffset = row.index % 2 === 1 ? SPACING.rowStagger : 0;
      
      for (let i = 0; i < studentCount; i++) {
        const student = this.session.students.get(row.studentIds[i]);
        if (!student) continue;
        
        // Base X position with stagger
        const x = startX + i * SPACING.betweenStudents + staggerOffset;
        
        // Y position based on row height and props
        let y = row.baseHeight;
        if (student.standingOnProp) {
          const prop = this.session.props.get(student.standingOnProp);
          if (prop) {
            y += prop.height;
          }
        }
        
        // Z position (row depth)
        const z = row.zPosition;
        
        student.position3D.set(x, y, z);
      }
    }
  }

  /**
   * Rebuild row student lists from student assignments
   */
  private rebuildRowStudentLists(): void {
    if (!this.session) return;
    
    // Clear all rows
    for (const row of this.session.rows) {
      row.studentIds = [];
    }
    
    // Rebuild from student assignments
    const studentsByRow: Map<number, Student[]> = new Map();
    for (const student of this.session.students.values()) {
      if (student.assignedRow >= 0) {
        if (!studentsByRow.has(student.assignedRow)) {
          studentsByRow.set(student.assignedRow, []);
        }
        studentsByRow.get(student.assignedRow)!.push(student);
      }
    }
    
    // Sort by position and assign to rows
    for (const [rowIdx, students] of studentsByRow) {
      students.sort((a, b) => a.positionInRow - b.positionInRow);
      this.session.rows[rowIdx].studentIds = students.map(s => s.id);
    }
  }

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  /**
   * Add a prop to the scene
   */
  addProp(type: PropType, position: THREE.Vector3): ClassPhotoProp {
    if (!this.session) throw new Error('No session , ');
    
    const definition = PROP_DEFINITIONS[type];
    const prop: ClassPhotoProp = {
      id: generateId(),
      ...definition,
      position: position.clone(),
      rotation: 0,
      assignedStudents: [],
    };
    
    this.session.props.set(prop.id, prop);
    return prop;
  }

  /**
   * Remove a prop
   */
  removeProp(propId: string): void {
    if (!this.session) return;
    
    const prop = this.session.props.get(propId);
    if (!prop) return;
    
    // Remove students from prop
    for (const studentId of prop.assignedStudents) {
      const student = this.session.students.get(studentId);
      if (student) {
        student.standingOnProp = undefined;
      }
    }
    
    this.session.props.delete(propId);
    this.calculateStudentPositions();
  }

  /**
   * Assign student to prop
   */
  assignStudentToProp(studentId: string, propId: string): boolean {
    if (!this.session) return false;
    
    const student = this.session.students.get(studentId);
    const prop = this.session.props.get(propId);
    if (!student || !prop) return false;
    
    // Check if prop has capacity
    if (prop.assignedStudents.length >= prop.seats) return false;
    
    // Remove from previous prop
    if (student.standingOnProp) {
      const prevProp = this.session.props.get(student.standingOnProp);
      if (prevProp) {
        prevProp.assignedStudents = prevProp.assignedStudents.filter(id => id !== studentId);
      }
    }
    
    // Assign to new prop
    student.standingOnProp = propId;
    prop.assignedStudents.push(studentId);
    
    this.calculateStudentPositions();
    return true;
  }

  /**
   * Add riser for a row
   */
  addRiserForRow(rowIndex: number): ClassPhotoProp | null {
    if (!this.session) return null;
    
    const row = this.session.rows[rowIndex];
    if (!row) return null;
    
    // Calculate riser position
    const position = new THREE.Vector3(0, 0, row.zPosition);
    
    // Create riser
    const riser = this.addProp('riser,', position);
    row.propIds.push(riser.id);
    
    // Assign all students in row to riser
    for (const studentId of row.studentIds) {
      this.assignStudentToProp(studentId, riser.id);
    }
    
    return riser;
  }

  /**
   * Suggest props based on visibility issues
   */
  private suggestProps(issues: VisibilityIssue[]): PropType[] {
    const suggestions: Set<PropType> = new Set();
    
    for (const issue of issues) {
      if (issue.visibilityScore < 50) {
        suggestions.add('riser,');
      } else if (issue.visibilityScore < 80) {
        suggestions.add('apple_box, ');
      }
    }
    
    return Array.from(suggestions);
  }

  // ---------------------------------------------------------------------------
  // Visibility
  // ---------------------------------------------------------------------------

  /**
   * Check visibility of all students
   */
  checkVisibility(): VisibilityIssue[] {
    if (!this.session) return [];
    
    const issues: VisibilityIssue[] = [];
    const students = Array.from(this.session.students.values());
    
    for (const student of students) {
      const blockedBy: string[] = [];
      let minVisibility = 100;
      
      // Check against all students in rows in front
      for (const other of students) {
        if (other.id === student.id) continue;
        if (other.assignedRow >= student.assignedRow) continue; // Only check front rows
        
        // Calculate if other student blocks this one
        const visibility = this.calculatePairVisibility(student, other);
        if (visibility < 100) {
          blockedBy.push(other.id);
          minVisibility = Math.min(minVisibility, visibility);
        }
      }
      
      student.visibilityScore = minVisibility;
      student.visible = minVisibility >= 50;
      
      if (minVisibility < 80) {
        issues.push({
          studentId: student.id,
          blockedBy,
          visibilityScore: minVisibility,
          suggestion: this.generateVisibilitySuggestion(student, minVisibility),
        });
      }
    }
    
    return issues;
  }

  /**
   * Calculate visibility between two students
   */
  private calculatePairVisibility(student: Student, blocker: Student): number {
    if (!this.session) return 100;
    
    // Get head positions
    const studentHeadY = student.position3D.y + (student.height / 100) * 0.9; // Eye level
    const blockerHeadY = blocker.position3D.y + (blocker.height / 100);
    
    // Check horizontal alignment (are they in line with camera?)
    const xDiff = Math.abs(student.position3D.x - blocker.position3D.x);
    const horizontalOverlap = xDiff < SPACING.betweenStudents * 0.7;
    
    if (!horizontalOverlap) return 100;
    
    // Calculate vertical visibility
    const heightDiff = studentHeadY - blockerHeadY;
    
    if (heightDiff >= SPACING.minHeadGap) {
      return 100; // Clearly visible
    } else if (heightDiff >= 0) {
      // Partially visible
      return 50 + (heightDiff / SPACING.minHeadGap) * 50;
    } else {
      // Blocked
      return Math.max(0, 50 + heightDiff * 200);
    }
  }

  /**
   * Generate suggestion for visibility issue
   */
  private generateVisibilitySuggestion(student: Student, visibility: number): string {
    if (visibility < 30) {
      return `Move ${student.name} to back row or add a 30cm riser`;
    } else if (visibility < 50) {
      return `Add apple box (20cm) under ${student.name}`;
    } else if (visibility < 80) {
      return `Slightly adjust ${student.name}, 's position`;
    }
    return ', ';
  }

  /**
   * Optimize arrangement for best visibility
   */
  optimizeVisibility(): ArrangementResult {
    if (!this.session) {
      return { success: false, rows: [], issues: [], suggestedProps: [] };
    }
    
    // Multiple passes of optimization
    for (let pass = 0; pass < 3; pass++) {
      const issues = this.checkVisibility();
      
      if (issues.length === 0) break;
      
      // Try to fix issues by reordering
      for (const issue of issues) {
        const student = this.session.students.get(issue.studentId);
        if (!student) continue;
        
        // Try moving to back row
        if (student.assignedRow < this.session.rows.length - 1) {
          this.moveStudentToRow(student.id, student.assignedRow + 1);
        }
      }
    }
    
    // Final check
    const finalIssues = this.checkVisibility();
    return {
      success: finalIssues.length === 0,
      rows: this.session.rows,
      issues: finalIssues,
      suggestedProps: this.suggestProps(finalIssues),
    };
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  // Teacher Management
  // ---------------------------------------------------------------------------

  /**
   * Add a teacher to the session
   */
  addTeacher(config: TeacherConfig): Student | null {
    if (!this.session) return null;
    
    const teacherCount = this.getTeachersArray().length;
    const teacherId = `teacher-${teacherCount + 1}`;
    
    const teacher: Student = {
      id: teacherId,
      index: this.session.students.size,
      name: config.name || `Teacher ${teacherCount + 1}`,
      height: config.height || TEACHER_HEIGHT.avg,
      assignedRow: -1,
      positionInRow: -1,
      pose: config.position === 'seated_center' ? 'seated' : 'standing',
      position3D: new THREE.Vector3(),
      visible: true,
      visibilityScore: 100,
      isTeacher: true,
      teacherRole: config.role,
      teacherPosition: config.position,
      color: TEACHER_COLORS[config.role],
    };
    
    this.session.students.set(teacherId, teacher);
    
    // Re-arrange to include new teacher
    this.autoArrangeStudents();
    
    return teacher;
  }

  /**
   * Remove a teacher from the session
   */
  removeTeacher(teacherId: string): boolean {
    if (!this.session) return false;
    
    const teacher = this.session.students.get(teacherId);
    if (!teacher || !teacher.isTeacher) return false;
    
    // Remove from row
    const row = this.session.rows[teacher.assignedRow];
    if (row) {
      row.studentIds = row.studentIds.filter(id => id !== teacherId);
    }
    
    this.session.students.delete(teacherId);
    
    // Re-arrange
    this.autoArrangeStudents();
    
    return true;
  }

  /**
   * Update teacher configuration
   */
  updateTeacher(teacherId: string, config: Partial<TeacherConfig>): boolean {
    if (!this.session) return false;
    
    const teacher = this.session.students.get(teacherId);
    if (!teacher || !teacher.isTeacher) return false;
    
    if (config.name) teacher.name = config.name;
    if (config.height) teacher.height = config.height;
    if (config.role) {
      teacher.teacherRole = config.role;
      teacher.color = TEACHER_COLORS[config.role];
    }
    if (config.position) {
      teacher.teacherPosition = config.position;
      teacher.pose = config.position === 'seated_center' ? 'seated' : 'standing';
    }
    
    // Re-arrange to apply position changes
    this.autoArrangeStudents();
    
    return true;
  }

  /**
   * Get all teachers as array
   */
  getTeachersArray(): Student[] {
    if (!this.session) return [];
    return Array.from(this.session.students.values()).filter(s => s.isTeacher);
  }

  /**
   * Get only students (not teachers) as array
   */
  getStudentsOnlyArray(): Student[] {
    if (!this.session) return [];
    return Array.from(this.session.students.values()).filter(s => !s.isTeacher);
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  /**
   * Get all students as array
   */
  getStudentsArray(): Student[] {
    if (!this.session) return [];
    return Array.from(this.session.students.values());
  }

  /**
   * Get all props as array
   */
  getPropsArray(): ClassPhotoProp[] {
    if (!this.session) return [];
    return Array.from(this.session.props.values());
  }

  /**
   * Get arrangement summary
   */
  getArrangementSummary(): string {
    if (!this.session) return ', ';
    
    let summary = `Class Photo: ${this.session.students.size} students in ${this.session.rows.length} rows\n\n`;
    
    for (const row of this.session.rows) {
      const rowStudents = row.studentIds.map(id => {
        const s = this.session!.students.get(id);
        return s ? `${s.name} (${Math.round(s.height)}cm)` : ', ';
      }).filter(Boolean);
      
      summary += `Row ${row.index + 1} (${row.baseHeight > 0 ? `+${Math.round(row.baseHeight * 100)}cm` : 'floor'}): `;
      summary += rowStudents.join('') +'\n';
    }
    
    return summary;
  }
}

// Singleton instance
export const classPhotoService = new ClassPhotoService();

export default classPhotoService;
