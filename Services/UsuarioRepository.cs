using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;

namespace TRG2._0_VNET.Services;

public sealed class UsuarioConflictException : Exception;

public interface IUsuarioRepository
{
    Task<List<Administrador>> ListAsync();
    Task<Administrador?> FindAsync(int id);
    Task<Administrador?> FindAsync(string username);
    Task SaveAsync(Administrador usuario, bool create = false);
    Task<(int Status, string Message)> DeleteAsync(int id, int currentId);
}

public sealed class UsuarioRepository(InventarioDbContext db) : IUsuarioRepository
{
    public Task<List<Administrador>> ListAsync() => db.Administradors.AsNoTracking().ToListAsync();
    public Task<Administrador?> FindAsync(int id) => db.Administradors.SingleOrDefaultAsync(x => x.Id == id);
    public Task<Administrador?> FindAsync(string username) => db.Administradors.SingleOrDefaultAsync(x => x.UserName == username);

    public async Task SaveAsync(Administrador usuario, bool create = false)
    {
        if (create) db.Administradors.Add(usuario);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException e) when (e.InnerException is SqlException { Number: 2601 or 2627 })
        { throw new UsuarioConflictException(); }
    }

    public async Task<(int Status, string Message)> DeleteAsync(int id, int currentId)
    {
        // Serialize administrator deletions, including validation of the current account.
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var usuarios = await db.Administradors
            .FromSqlRaw("SELECT * FROM dbo.Administrador WITH (UPDLOCK, HOLDLOCK)").ToListAsync();
        var usuario = usuarios.SingleOrDefault(x => x.Id == id);
        if (usuario is null) return (404, "Usuario no encontrado");
        if (id == currentId) return (409, "No puedes eliminar la cuenta con la que iniciaste sesión");
        if (usuarios.Count <= 1) return (409, "No se puede eliminar el último administrador");
        if (!usuarios.Any(x => x.Id == currentId)) return (401, "La cuenta de administrador ya no existe.");
        db.Administradors.Remove(usuario);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return (200, "Usuario eliminado correctamente");
    }
}
