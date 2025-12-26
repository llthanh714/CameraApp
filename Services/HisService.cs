namespace CameraApp.Services
{
    public class Patient
    {
        public string Id { get; set; } = "";
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public int Age { get; set; }
        public string Gender { get; set; } = "";
        public string ServiceName { get; set; } = "";
        public string Status { get; set; } = "Waiting";
        public DateTime CheckInTime { get; set; }
    }

    public class HisService
    {
        private readonly List<Patient> _patients;

        public HisService() => _patients =
            [
                new Patient { Id = "101", Code = "PC032512345", Name = "Nguyễn Văn An", Age = 32, Gender = "Nam", ServiceName = "Siêu âm ổ bụng tổng quát", Status = "Examining", CheckInTime = DateTime.Now.AddMinutes(-15) },
                new Patient { Id = "102", Code = "PC032512346", Name = "Trần Thị Bích", Age = 28, Gender = "Nữ", ServiceName = "Siêu âm thai 12 tuần", Status = "Waiting", CheckInTime = DateTime.Now.AddMinutes(-10) },
                new Patient { Id = "103", Code = "PC032512347", Name = "Lê Văn Cường", Age = 45, Gender = "Nam", ServiceName = "Siêu âm tim", Status = "Waiting", CheckInTime = DateTime.Now.AddMinutes(-5) },
                new Patient { Id = "104", Code = "PC032512348", Name = "Phạm Thị Dung", Age = 60, Gender = "Nữ", ServiceName = "Siêu âm tuyến giáp", Status = "Done", CheckInTime = DateTime.Now.AddMinutes(-45) },
                new Patient { Id = "105", Code = "PC032512349", Name = "Hoàng Tuấn Tú", Age = 12, Gender = "Nam", ServiceName = "Siêu âm phần mềm", Status = "Waiting", CheckInTime = DateTime.Now }
            ];

        public Task<List<Patient>> GetWorklistAsync()
        {
            return Task.FromResult(_patients.OrderByDescending(p => p.Status == "Examining").ThenBy(p => p.CheckInTime).ToList());
        }

        public Task<Patient?> GetPatientByIdAsync(string id)
        {
            var patient = _patients.FirstOrDefault(p => p.Id == id);
            return Task.FromResult(patient);
        }
    }
}