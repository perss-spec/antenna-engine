//! Wire geometry for MoM analysis

use nalgebra::Point3;

/// Wire segment
#[derive(Debug, Clone)]
pub struct Segment {
    pub start: Point3<f64>,
    pub end: Point3<f64>,
}

impl Segment {
    pub fn new(start: Point3<f64>, end: Point3<f64>) -> Self {
        Self { start, end }
    }
    
    pub fn length(&self) -> f64 {
        (self.end - self.start).norm()
    }
    
    pub fn center(&self) -> Point3<f64> {
        Point3::new(
            (self.start.x + self.end.x) / 2.0,
            (self.start.y + self.end.y) / 2.0, 
            (self.start.z + self.end.z) / 2.0,
        )
    }
    
    pub fn direction(&self) -> Point3<f64> {
        let dir = self.end - self.start;
        let len = dir.norm();
        if len > 1e-12 {
            Point3::new(dir.x / len, dir.y / len, dir.z / len)
        } else {
            Point3::new(0.0, 0.0, 1.0) // Default direction
        }
    }
}

/// Wire structure composed of segments
#[derive(Debug, Clone)]
pub struct Wire {
    segments: Vec<Segment>,
}

impl Wire {
    /// Create a new wire from start to end point with specified number of segments
    pub fn new(start: Point3<f64>, end: Point3<f64>, num_segments: usize) -> Self {
        if num_segments == 0 {
            panic!("Wire must have at least one segment");
        }
        
        let mut segments = Vec::with_capacity(num_segments);
        let delta = (end - start) / (num_segments as f64);
        
        for i in 0..num_segments {
            let seg_start = start + delta * (i as f64);
            let seg_end = start + delta * ((i + 1) as f64);
            segments.push(Segment::new(seg_start, seg_end));
        }
        
        Self { segments }
    }
    
    /// Create wire from a list of points
    pub fn from_points(points: &[Point3<f64>]) -> Self {
        if points.len() < 2 {
            panic!("Wire needs at least 2 points");
        }
        
        let mut segments = Vec::with_capacity(points.len() - 1);
        
        for i in 0..points.len() - 1 {
            segments.push(Segment::new(points[i], points[i + 1]));
        }
        
        Self { segments }
    }
    
    pub fn segments(&self) -> &[Segment] {
        &self.segments
    }
    
    pub fn total_length(&self) -> f64 {
        self.segments.iter().map(|s| s.length()).sum()
    }
    
    pub fn num_segments(&self) -> usize {
        self.segments.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_segment_creation() {
        let start = Point3::new(0.0, 0.0, 0.0);
        let end = Point3::new(1.0, 0.0, 0.0);
        let seg = Segment::new(start, end);
        
        assert_eq!(seg.length(), 1.0);
        assert_eq!(seg.center(), Point3::new(0.5, 0.0, 0.0));
    }
    
    #[test]
    fn test_wire_creation() {
        let start = Point3::new(0.0, 0.0, 0.0);
        let end = Point3::new(1.0, 0.0, 0.0);
        let wire = Wire::new(start, end, 10);
        
        assert_eq!(wire.num_segments(), 10);
        assert!((wire.total_length() - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_wire_from_points() {
        let points = vec![
            Point3::new(0.0, 0.0, 0.0),
            Point3::new(0.5, 0.0, 0.0),
            Point3::new(1.0, 0.0, 0.0),
        ];
        
        let wire = Wire::from_points(&points);
        assert_eq!(wire.num_segments(), 2);
        assert!((wire.total_length() - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_segment_direction() {
        let seg = Segment::new(
            Point3::new(0.0, 0.0, 0.0),
            Point3::new(1.0, 0.0, 0.0),
        );
        
        let dir = seg.direction();
        assert!((dir.x - 1.0).abs() < 1e-10);
        assert!(dir.y.abs() < 1e-10);
        assert!(dir.z.abs() < 1e-10);
    }
}