package com.sfh.pokeRogueBot.repository;

import com.sfh.pokeRogueBot.model.entities.RunPropertyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RunPropertyEntityRepository extends JpaRepository<RunPropertyEntity, Integer>{

    @Query("SELECT r FROM RunPropertyEntity r ORDER BY r.runNumber DESC")
    Optional<RunPropertyEntity> findFirstOrderByRunNumberDesc();


}
