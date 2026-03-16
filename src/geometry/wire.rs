use super::{Point3D, Segment};

#[derive(Debug, Clone)]
pub struct Wire {
    start: Point3D,
    end: Point3D,
    radius: f64,
    segments: Vec<Segment>,
}

impl Wire {
    pub fn new(start: Point3D, end: Point3D, radius: f64, num_segments: usize) -> Self {
        let mut segments = Vec::with_capacity(num_segments);
        let direction = end - start;
        let total_length = direction.norm();
        let segment_length = total_length / num_segments as f64;

        for i in 0..num_segments {
            let t1 = i as f64 / num_segments as f64;
            let t2 = (i + 1) as f64 / num_segments as f64;

            let seg_start = start + direction * t1;
            let seg_end = start + direction * t2;

            segments.push(Segment::new(seg_start, seg_end, radius));
        }

        Self {
            start,
            end,
            radius,
            segments,
        }
    }

    pub fn start(&self) -> Point3D {
        self.start
    }

    pub fn end(&self) -> Point3D {
        self.end
    }

    pub fn radius(&self) -> f64 {
        self.radius
    }

    pub fn segments(&self) -> &[Segment] {
        &self.segments
    }

    pub fn length(&self) -> f64 {
        (self.end - self.start).norm()
    }

    pub fn num_segments(&self) -> usize {
        self.segments.len()
    }
}